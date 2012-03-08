$(function() {
  var app = window.app = window.app || {};

  var SHORT_TIME_RE = "((s|sec(ond)?(s)?)|(m|min(ute)?(s)?)|(h|hour(s)?))";
  var LONG_TIME_RE  = "(day(s)?)|(week(s)?)|(month(s)?)";
  var LONG_TIME_CHECK_RE  = /(day(s)?)|(week(s)?)|(month(s)?)/i;
  var NUM_RE = "((\\d\\d\\d\\d)|([2-5]?1(st)?|[2-5]?2(nd)?|[2-5]?3(rd)?|(0|[1-5]?[4-9]|[1-5]0|1[1-3])(th)?))";
  var ALLOWED_RE = new RegExp("every\\s+" + NUM_RE + "\\s+(" + SHORT_TIME_RE + "|" + LONG_TIME_RE + ")", "i");

  var Task = app.Task = Backbone.Model.extend({
    defaults: function() {
      return {
        title: "Mow the lawn",
        schedule: 'every 10 mins',
        last: new Date(),
        next: new Date(new Date().getTime() + 10 * 60 * 1000)
      };
    },

    initialize: function() {
      this.on('change:last change:schedule', this.recalculateNext);
    },

    progressBarClass: function() {      
      if (this.percentageComplete() < 50) return 'progress-success';
      if (this.percentageComplete() < 75) return 'progress-info';
      return 'progress-danger';    
    },

    nextDate: function() {        
      return new Date(this.get('next'));
    },
    
    nextISO: function() {      
      return this.nextDate().toISOString();
    },

    lastDate: function() {
      return new Date(this.get('last'));
    },

    lastISO: function() {
      return this.lastDate().toISOString();
    },

    percentageComplete: function() {
      var now          = new Date();
      var lengthOfTime = this.nextDate().getTime() - this.lastDate().getTime();
      var timePassed   = now.getTime() - this.lastDate().getTime();
      var percentageComplete = (timePassed / lengthOfTime) * 100;
      return percentageComplete > 100 ? 100 : percentageComplete;
    },

    done: function() {
      this.set({ last: new Date() });      
    },

    recalculateNext: function() {     
      var scheduleRule = this.get('schedule'); 
      scheduleRule = scheduleRule.replace('every', 'after');      
      if (LONG_TIME_CHECK_RE.test(scheduleRule)) {
        scheduleRule = scheduleRule + " of the year";
      }
      
      var schedule = enParser().parse(scheduleRule);
      if (schedule.Error) {
        this.trigger("error", schedule.Error);
        return;
      }      
      var nextOccurance = later().getNext(schedule, this.lastDate()); 
      this.set({ next: nextOccurance });
    },

    saveChanged: function() {
      this.save(this.changedAttributes());
    },    

    validate: function(attrs) {      
      if (attrs.schedule) {
        if (!ALLOWED_RE.test(attrs.schedule)) {
          return "invalid schedule";
        }
      }
    }
  });

  var TaskList = app.TaskList = Backbone.Collection.extend({
    model: Task,
    url: 'http://localhost:3000/tasks'

    //localStorage: new Store("tasker")
  });

  var Tasks = app.Tasks = new TaskList();

  var TaskView = app.TaskView = Backbone.View.extend({
    tagName: 'li',
    className: 'span3',

    template: T['task'],

    events: {
      'click .notEdit .clickToEdit': 'edit',
      'click .cancel': 'close',
      'click .save': 'save',
      'click .close': 'clear',
      'click .done': 'done',
      'keypress input[type=text]': 'saveOnEnter'
    },

    initialize: function() {
      this.model.bind('change', this.render, this);
      this.model.bind('destroy', this.remove, this);
      this.interval = setInterval(this.update.bind(this), 3000);  
    },   

    update: function() {
      if (!this.$el.hasClass("editing")) {      
        var progress = this.$el.find('.progress');
        var progressClasses = ['progress-success', 'progress-info', 'progress-danger'];
        var classesToRemove = _(progressClasses).without([this.model.progressBarClass()]);
        progress.removeClass(classesToRemove.join(" "));
        progress.addClass(this.model.progressBarClass());

        this.$el.find('time.nextTime').attr('datetime', this.model.nextISO());
        this.$el.find('.progress .bar').css('width', this.model.percentageComplete() + "%");
        this.$el.find("time.timeago").timeago();
      }
    },

    render: function() {          
      var context = _(this.model.toJSON()).extend({
        nextISO: this.model.nextISO(),
        lastISO: this.model.lastISO(),
        percentageComplete: this.model.percentageComplete(),
        progressBarClass: this.model.progressBarClass()
      });
      
      this.$el.html(this.template.render(context));      
      this.$el.find("time.timeago").timeago();
      return this;
    },

    edit: function() {
      var self = this;
      this.$el.addClass("editing");
      setTimeout(function() {      
        self.$el.find('input.title').focus();      
      }, 0);      
    },

    saveOnEnter: function(e) {
      if (e.keyCode != 13) return;
      this.save();
    },

    markErrored: function(model, error) {
      this.$el.find('.control-group.schedule').addClass('error');
    },

    save: function() {
      var success = this.model.set({
        title: this.$el.find('input.title').val(),
        schedule: this.$el.find('input.schedule').val()
      }, { 
        error: _(this.markErrored).bind(this)
      });

      if (success) {
        this.$el.find('.control-group.schedule').removeClass('error');
        this.model.saveChanged();
        this.render();
        this.close();
      }      
    },

    close: function() {
      this.$el.removeClass("editing");
    },

    remove: function() {
      clearInterval(this.interval);
      this.$el.remove();
    },

    clear: function() {
      this.model.destroy();
    },

    done: function() {
      this.model.done();
      this.model.saveChanged();
      this.render();
    }
  });

  var AppView = app.AppView = Backbone.View.extend({
    el: $('#taskApp'),

    events: {
      'click #createTask': 'createTask'
    },

    initialize: function() {
      Tasks.bind('add', this.addOne, this);
      Tasks.bind('reset', this.addAll, this);
      Tasks.bind('all', this.render, this);

      Tasks.fetch();
    },

    createTask: function() {      
      var task = Tasks.create({});
    },

    add: function(task) {
      var view = new TaskView({model: task});    
      $('#taskList').append(view.render().el);
      return view;
    },

    addOne: function(task) {
      this.add(task).edit();
    },

    addAll: function() {
      Tasks.each(this.add);
    }
  });

  var App = app.App = new AppView();
});