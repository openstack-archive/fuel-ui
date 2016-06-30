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
  'intern/dojo/node!leadfoot/Command'
], function(_, assert, Command) {
  _.defaults(Command.prototype, {
    updatePlugin: function(files) {
      return new this.constructor(this, function() {
        return this.parent
            .then(function() {
              /*eslint-disable */
              require(['intern/dojo/node!child_process'], function (child_process) {
                child_process.exec('/bin/sh ${SCRIPT_PATH} ' + files,
                  function (err, stdout, stderr) {
                    if (stdout) console.log(stdout);
                    if (stderr) console.log(stderr);
                });
              });
              /*eslint-enable */
            })
            .sleep(250);  // wait for plugin update
      });
    },
    newClusterFillName: function(modal) {
      return new this.constructor(this, function() {
        return this.parent
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', 'Temp');
      });
    }
  });
});
