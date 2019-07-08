const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const axios = require('axios');
const uuidv4 = require('uuid/v4');
const config = require('config');

/* Class representing an instance of a lighthouse report */
class LighthouseRun {
  constructor(summary) {
    this.summary = summary;
    this.details = [];
  }

  addPerformanceDetail(audit, auditGroup, auditGroupTitle) {
    // console.log(`${JSON.stringify(metric, undefined, 2)}`);
    if (!this.summary) {
      console.log('WARNING - no summary data');
    }

    let detail = {
      eventType: 'LighthouseDetail',
      runId: this.summary.runId,
      timestamp: this.summary.timestamp,
      categoryId: this.summary.categoryId,
      url: this.summary.url,
      pageUrl: this.summary.url,
      id: audit.id,
      description: audit.description,
      title: audit.title,
      group: auditGroup,
      groupTitle: auditGroupTitle,
      displayValue: audit.displayValue,
      numericValue: audit.numericValue,
      score: audit.score,
    }

    this.details.push(detail);
  }

  getSummary() {
    return this.summary;
  }

  getDetails() {
    return this.details;
  }

  getAsEvents() {
    let events = [this.getSummary()];
    events = events.concat(this.getDetails());
    return events;
  }
}

/* Publish report results to Insights */
const publish = async(lighthouseRuns) => {
  
  console.log('publishing runs to Insights');
  
  let events = [];
  lighthouseRuns.forEach((run) => {
    events = events.concat(run.getAsEvents());
  });
  
  let url = `https://insights-collector.newrelic.com/v1/accounts/${config.get('accountId')}/events`;
  let axiosConfig = {
    headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Insert-Key': config.get('insertKey'),
    }
  };

  await axios.post(url, events, axiosConfig).catch((err) => {
    console.log("AXIOS ERROR: ", err);
  });

  return(`posted ${events.length} events`);
}

/* Execute the report in Chrome */
const launchChromeAndRunLighthouse = async(url, opts, config = null) => {
  return chromeLauncher.launch({chromeFlags: opts.chromeFlags}).then(chrome => {
    opts.port = chrome.port;
    return lighthouse(url, opts, config).then(results => {
      // use results.lhr for the JS-consumeable output
      // use results.report for the HTML/JSON/CSV output as a string
      return chrome.kill().then(() => results.lhr)
    });
  });
}

/* set the flags for this url */
const setFlags = (urlDefs) => {
  const flags = {
    chromeFlags: ['--headless'],
    onlyCategories: urlDefs.categories,
  };

  if (urlDefs.audits) {
    flags.onlyAudits = urlDefs.audits;
  }

  return flags;
}

/* Generate Lighthouse report for a specific URL */
const runForUrl = async(urlDefs) => {
  const runs = [];
  
  console.log(`running lighthouse report for ${urlDefs.url}`);

  const flags = setFlags(urlDefs);
  
  const results = await launchChromeAndRunLighthouse(urlDefs.url, flags);

  const runId = uuidv4();
  const timestamp = results.fetchTime;
  const userAgent = results.userAgent;

  // for each of the categories from config, parse the results
  flags.onlyCategories.forEach((name) => {
    console.log(`==> extracting results for ${name}`);

    let category = results.categories[name]; // object
    // let categoryConfig = config.get(name);

    // create the Run event
    const run = new LighthouseRun({
      eventType: 'LighthouseRun',//config.get("eventMap").name,
      runId,
      url: results.requestedUrl,
      pageUrl: results.requestedUrl,
      timestamp,
      userAgent,
      categoryId: category.id,
      title: category.title,
      score: category.score,
    });

    category.auditRefs.forEach((ref) => {
      let group = results.categoryGroups[ref.group];
      run.addPerformanceDetail(results.audits[ref.id], ref.group, group ? group.title : '');
    });

    runs.push(run);
  });

  return runs;
}

/* Choose the appropriate audit object. onlyAudits flag will be null if no config is set */
const getAudits = (url) => {
  if (url.audits) {
    return url.audits;
  }

  if (config.has('audits')) {
    return config.get('audits');
  }
}

/* Set up the proper category and audit config for each URL */
const parseUrlDefinitions = () => {
  const urls = [];

  for (let url of config.get('urls')) {
    let urlConfig;

    console.log(`parsing url definition ${JSON.stringify(url)}`);

    if (typeof url === 'string') {
      urlConfig = {
        url,
        categories: config.get('categories'),
        audits: config.has('audits') ? config.getAudits() : null
      }
    } else {
      urlConfig = {
        url: url.url,
        categories: url.categories !== undefined ? url.categories : config.get('categories'),
        audits: getAudits(url)
      }
    }

    urls.push(urlConfig);
  }

  return urls;
}

const run = async() => {
  let runs = [];

  const urlDefs = parseUrlDefinitions();

  for (let config of urlDefs) {
    await runForUrl(config).then((results) => runs = runs.concat(results));
  };

  const publishResult = await publish(runs);

  console.log(publishResult);
}

module.exports = {
  run
}