
/**
 * Module dependencies.
 */

var express = require('express');

var routes = {};
routes.hoganCompiler = require('./app/hoganCompiler');
routes.store = require('./app/store');
var RedisStore = require('connect-redis')(express);

var app = module.exports = express.createServer();

// Ensure user_id in session


// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'idunno', store: new RedisStore() }));
  app.use(routes.store.ensureUserId);
  app.use(express.methodOverride());
  app.use(express.logger());
  app.use(routes.store.ensureUserId);
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Recur_In'
  });
});

app.get('/tasks', routes.store.getTasks);
app.post('/tasks', routes.store.putTask);
app.put('/tasks/:id', routes.store.putTask);
app.delete('/tasks/:id', routes.store.deleteTask)

// Hogan precompile
app.get('/javascripts/templates.js', routes.hoganCompiler.getAll);

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", app.address().port);
}
