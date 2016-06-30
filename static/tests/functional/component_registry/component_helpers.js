/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

define([
  'intern/dojo/node!lodash',
  'intern/chai!assert',
  'intern/dojo/node!child_process',
  'intern/dojo/node!leadfoot/Command'
], function(_, assert, childProcess, Command) {
  'use strict';

  _.defaults(Command.prototype, {
    updatePlugin: function(files) {
      return new this.constructor(this, function() {
        return this.parent
          .then(function() {
            childProcess.exec('/bin/sh ${SCRIPT_PATH} ' + files,
              function(err) {
                if (err) return;
              });
          })
          .sleep(250);  // wait for plugin update
      });
    },
    newClusterFillName: function(modal) {
      return new this.constructor(this, function() {
        return this.parent
        .waitForCssSelector('.create-cluster', 500)
//          .assertElementExists('.create-cluster')
//          .catch(function () {
//            modal.waitToClose();
//          })
          .clickByCssSelector('.create-cluster')
          .then(function() {
            modal.waitToOpen();
          })
          .waitForCssSelector('input[name=name]', 500)
          .setInputValue('input[name=name]', 'Temp');
      });
    },
    assertNextButtonEnabled: function() {
      return new this.constructor(this, function() {
        return this.parent
          .assertElementNotExists('button.next-pane-btn.disabled',
                                  'Next button is disabled');
      });
    },
    deleteCluster: function(modal) {
      return new this.constructor(this, function() {
        return this.parent
          .clickByCssSelector('button.delete-environment-btn')
          .then(function() {
            modal.waitToOpen();
          })
          .clickByCssSelector('button.remove-cluster-btn')
          .then(function() {
            modal.waitToClose();
          });
      });
    }
  });
});
