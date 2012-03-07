// Dependencies
var hogan = require('hogan');
var fs = require('fs');
var async = require('async');
var jade = require('jade');
require('sugar');

// Constants
var templateDir = __dirname + '/../templates';

// Utility functions
var compileAllTemplates = function(callback) {
  var results = "T={};";

  fs.readdir(templateDir, function(err, files) {
    if(err) return callback(err);

    var compileFile = function(file, done) {
      fs.readFile(templateDir + '/' + file, function(err, contents) {
        if(err) return done(err);
        
        var compiledJade = jade.compile(contents.toString());
        var renderedJade = compiledJade({});
        var compiled = hogan.compile(renderedJade, { asString: true });
        var name = file.split('.').first();
        if(name == '') return done();
        results = results + "\nT['" + name + "'] = new Hogan.Template(" + compiled + ");";
        done();
      });
    };

    async.forEach(files, compileFile, function(err) {
      if(err) return callback(err);
      callback(null, results);
    });
  });
};

// Exports
exports.getAll = function(req, res, next) {
  compileAllTemplates(function(err, compiledTemplates) {
    if(err) return next(err);

    res.header('Content-Type', 'text/javascript');
    res.send(compiledTemplates);
  });
};