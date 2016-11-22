Lots of mess and leftover stuff not currently functional (like the original UI for doing pilot info mgmt).
Things I hope to do still to get this up to relevance for others:

* my NCF proto not in here yet
* process for adding CREST-tokens for chars not in here yet
* docker image for nginx/mysql build and env

Usage:

* see secrets.txt for things that need to be setup
* copy config.sample.json to config.json and enter secrets
* requires a mysql DB; use the schema_*.sql to load initial state/schemas
* run app.js for the web system
* expects some kind of reverse proxy in front (nginx); see nginx.sample.conf
* run loader.js for stand-alone contract XML->DB loader
