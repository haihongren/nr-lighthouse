# nr-lighthouse

A basic integration to [publish Google Lighthouse reports into Insights](https://newrelic.jiveon.com/people/aolsen@newrelic.com/blog/2019/07/08/integrate-lighthouse-reports-into-new-relic).

## Pre-requisites

* Node 10.13^
* Chrome installed

## Configuration

The [config](https://www.npmjs.com/package/config) node package is used to manage configuration for the app. Config files must reside in the config directory. See config/examples.json.

* `accountId` The target New Relic account for Insights publication. Mandatory.
* `insertKey` The Insights insert key. Mandatory.
* `urls` An array of URLs to report on. Mandatory. Can be a string, or can be an object containing configuration overrides. See example.json.
* `categories` The global report categories to include. Mandatory. Overridden by url-specific configuration.
* `audits` The global audits to include. Optional. Overridden by url-specific configuration.

## Execute

```
$ node scripts/app.js
```
