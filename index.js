'use strict';

var express = require('express');
var hbs = require('express-hbs');
var util = require('util');
var JiraApi = require('jira').JiraApi;
var bodyParser = require('body-parser');
var _ = require('lodash');

var JiraQuery = require('./jiraquery');

try {
  var config = require('../sred-jira-config.json');
} catch(e) {
  var config = {
    host: process.env.JIRA_HOST,
    port: process.env.JIRA_PORT,
    user: process.env.JIRA_USER,
    password: process.env.JIRA_PASS
  };
}

var jira = new JiraApi('https', config.host, config.port, config.user, config.password, '2');
var app = express();

app.engine('hbs', hbs.express4({
    partialsDir: __dirname + '/views/partials'
}));
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.get('/', function(req, res) {
  var query = req.query.query || 'project = web';
  jira.searchJira(query, { fields: ['*all'], expand:['changelog'] }, function(error, body) {
    if (error) {
      res.render('index', {
        errors: error.errorMessages,
        query: query
      });
    } else {
      res.render('index', {
        query: query,
        issues: _.map(body.issues, function(issue) {
          issue.checked = true;
          return issue;
        })
      });
    }
  });
});

app.post('/calculate', function(req, res) {
  var query = new JiraQuery();
  var tickets = _.keys(_.omit(req.body, 'query'));
  var queryPromise = query.addTickets(tickets);
  queryPromise.then(function() {
    jira.searchJira(req.body.query, { fields: ['*all'], expand:['changelog'] }, function(error, body) {
      if (error) {
        res.render('index', {
          errors: error.errorMessages,
          query: req.body.query
        });
      } else {
        var calendar = query.getCalendar();
        var people = calendar.getPeople();
        var data = {
          query: req.body.query,
          issues: _.map(body.issues, function(issue) {
            if (_.indexOf(tickets, issue.key) != -1) {
              issue.checked = true;
            }
            return issue;
          }),
          people: []
        };
        _.reduce(people, function(acc, person) {
          acc.push({
            name: person,
            hours: calendar.getWorkingHours(person)
          });
          return acc;
        }, data.people);

        res.render('index', data);
      }
    });
  });
});

app.listen(3000, function() {
  console.log('listening on port 3000!');
});
