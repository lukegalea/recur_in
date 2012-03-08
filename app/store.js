var redis = require('redis');
var client = redis.createClient();
var uuid = require('node-uuid');
var async = require('async');
require('sugar');

client.on("error", function (err) {
  console.log("Error " + err);
});

exports.ensureUserId = function(req, res, next) {
  if (!req.session.userId) {
    req.session.userId = uuid.v4();    
  } 
  req.tasksKey = "tasks" + ":" + req.session.userId;     
  next();
};

// Each user has a set of all their tasks (by id)
// There is a hash of task id -> task json

exports.getTasks = function(req, res, next) {
  client.zrange(req.tasksKey, 0, 100, function(err, tasks) {
    if (err) return next(err);

    async.map(tasks, client.hgetall.bind(client), function(err, taskObjs) {
      if (err) return next(err);
      res.send(JSON.stringify(taskObjs));
    })        
  }); 
};

exports.putTask = function(req, res, next) {
  var taskParams = req.body;
  taskParams.id = taskParams.id || uuid.v4();
  var key = req.tasksKey + ":" + taskParams.id;
  var score = (new Date()).getTime(); 
  var multi = client.multi(); 
  multi.hmset(key, taskParams);
  multi.zadd(req.tasksKey, score, key);
  multi.exec(function(err, replies) {
    if (err) return next(err);
    res.send(JSON.stringify(taskParams));  
  })  
};

exports.deleteTask = function(req, res, next) {  
  var key = req.tasksKey + ":" + req.params.id;
  var multi = client.multi();
  multi.zrem(req.tasksKey, key)
    .hkeys(key, function(err, fields) {
      if (err) return next(err);     
      multi.hdel(key, fields);
    }).exec(function(err, replies) {
      if (err) return next(err);
      res.send("DELETED");
    });
};