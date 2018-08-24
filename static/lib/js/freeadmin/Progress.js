define([
  "dojo/_base/declare",
  "dojo/dom-attr",
  "dojo/dom-style",
  "dojo/request/xhr",
  "dijit/_Widget",
  "dijit/_TemplatedMixin",
  "dijit/form/TextBox",
  "dijit/form/Button",
  "dijit/layout/TabContainer",
  "dijit/layout/ContentPane",
  "dijit/ProgressBar",
  "dojox/timing",
  "dojox/string/sprintf",
  "dojo/text!freeadmin/templates/progress.html"
  ], function(
  declare,
  domAttr,
  domStyle,
  xhr,
  _Widget,
  _Templated,
  TextBox,
  Button,
  TabContainer,
  ContentPane,
  ProgressBar,
  timing,
  sprintf,
  template) {

  var Progress = declare("freeadmin.Progress", [ _Widget, _Templated ], {
    templateString : template,
    _numSteps: 1,
    _curStep: 1,
    _mainProgress: "",
    _subProgress: "",
    _iter: 0,
    _message: "",
    name : "",
    fileUpload: false,
    importProgress: false,
    mode: "advanced",
    poolUrl: "",
    steps: "",
    retries: 0,
    postCreate : function() {

      var me = this;

      this._numSteps = this.steps.length;
      this._iter = 0;
      this._perStep = 100 / this._numSteps;
      this._mainProgress = ProgressBar({
        indeterminate: true,
        style: {width: "280px"}
      }, this.dapMainProgress);

      this._subProgress = ProgressBar({
        indeterminate: true,
        style: {width: "280px"}
      }, this.dapSubProgress);

      if(this.mode == "simple") {
        domStyle.set(this.dapMain, "display", "none");
        domStyle.set(this.dapSubLabel, "display", "none");
        domStyle.set(this.dapDetails, "display", "none");
        domStyle.set(this.dapETA, "display", "none");
      }

      if(this.mode == "single") {
        domStyle.set(this.dapMain, "display", "none");
        domStyle.set(this.dapDetails, "word-wrap", "break-word");
        domStyle.set(this.dapDetails, "word-break", "break-word");
      }

      if(this.mode == "import") {
        domStyle.set(this.dapSub, "display", "none");
        domStyle.set(this.dapMainLabel, "word-wrap", "break-word");
        domStyle.set(this.dapMainLabel, "word-break", "break-word");
      }

      if(this.importProgress ) {
        this.update("");
      }

      this.inherited(arguments);

    },
    _masterProgress: function(curSub) {
      var initial = this._perStep * (this._curStep - 1);
      this._mainProgress.update({
        maximum: 100,
        progress: initial + ((this._perStep / 100) * curSub),
        indeterminate: false
      });
    },
    update: function(uuid) {

      var updateProgress = function(data) {
        if(!data) return;
        if(data.step) {
          me._curStep = data.step;
        }
        if(data.details) {
          me.dapDetails.innerHTML = data.details;
        }
        if(data.percent) {
          if(data.percent == 100) {
            me._subProgress.update({'indeterminate': true});
            me._masterProgress(data.percent);
            if(me._curStep == me._numSteps)
              return;
          } else {
            me._subProgress.update({
              maximum: 100,
              progress: data.percent,
              indeterminate: false
            });
            me._masterProgress(data.percent);
          }
        } else {
          me._masterProgress(0);
          me._subProgress.update({'indeterminate': true});
        }
      };

      var me = this;
      if(uuid) this.uuid = uuid;
      if(!this.dapMainLabel) return;
      if(!this.importProgress) {
        this.message = this.steps[this._curStep - 1];
        this.dapMainLabel.innerHTML = sprintf("(%d/%d) %s", this._curStep, this._numSteps, this.message.label);
      } else
        this.dapMainLabel.innerHTML = this._message;
      if(this.fileUpload && this._curStep == 1) {
        xhr.get('/progress', {
          headers: {"X-Progress-ID": me.uuid}
        }).then(function(data) {
          var obj = eval(data);
          if(obj.state == 'uploading') {
            var perc = Math.ceil((obj.received / obj.size)*100);
            if(perc == 100) {
              me._subProgress.update({'indeterminate': true});
              me._masterProgress(perc);
              if(me._numSteps == 1) {
                return;
              }
              me._curStep += 1;
              setTimeout(function() {
                me.update();
              }, 1000);
            } else {
              me._subProgress.update({
                maximum: 100,
                progress: perc,
                indeterminate: false
              });
              me._masterProgress(perc);
            }
          }
          if(obj.state == 'starting' || obj.state == 'uploading') {
            if(obj.state == 'starting' && me._iter >= 3) {
              return;
            }
            setTimeout(function() {
              me.update();
            }, 1000);
          }
        });
        me._iter += 1;
      } else if (this.importProgress) {
          xhr.get(me.poolUrl, {
            handleAs: "json"
          }).then(function(data) {
            if (this.importProgress) {
              if(data.status && data.volume && data.extra) {
                me._message = data.status + " " + data.volume + ": " + data.extra;
              }
            }
            if(data.status == 'error' || data.status == 'finished') {
              me.onFinished();
              return;
            }
            if(data.percent) {
              if(data.percent == 100) {
                me._mainProgress.update({'indeterminate': true});
              } else {
                me._mainProgress.update({
                  maximum: 100,
                  progress: data.percent,
                  indeterminate: false
                });}
              } else {
                  me._mainProgress.update({'indeterminate': true});
              }
              setTimeout(function() {
                me.update();
              }, 1000);
        });
      } else {
          xhr.get(me.poolUrl, {
            headers: {"X-Progress-ID": me.uuid},
            handleAs: "json"
          }).then(function(data) {
            updateProgress(data);
            setTimeout(function() {
              me.update();
            }, 1000);
          }, function(evt) {
            if(me.retries < 50) {
              setTimeout(function() {
                me.update();
              }, 1000);
            me.retries++;
            }
          });
          }
    },
    destroy: function() {
      //this.timer.stop();
      this.inherited(arguments);
    },
    onFinished: function() {
    }
  });
  return Progress;
});
