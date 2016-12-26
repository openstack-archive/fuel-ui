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
  'intern/dojo/node!leadfoot/Command',
  'tests/functional/helpers'
], function(_, assert, childProcess, Command) {
  'use strict';

  _.defaults(Command.prototype, {
    updatePlugin: function(params) {
      return new this.constructor(this, function() {
        return this.parent
          .then(function() {
            childProcess.exec('/bin/bash ${SCRIPT_PATH} ' + params,
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
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', 'Temp');
      });
    },
    newClusterWithPlugin: function(modal) {
      return new this.constructor(this, function() {
        return this.parent
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', 'Temp')

          .pressKeys('\uE007') // go to Compute
          .pressKeys('\uE007') // Networking
          .pressKeys('\uE007') // Storage
          .pressKeys('\uE007') // Additional Services
          .clickByCssSelector('input[name="additional_service:service_plugin_v5_component"]')

          .pressKeys('\uE007') // Finish
          .pressKeys('\uE007') // Create
          .then(function() {
            return modal.waitToClose();
          });
      });
    },
    assertNextButtonEnabled: function() {
      return new this.constructor(this, function() {
        return this.parent
          .assertElementNotExists('button.next-pane-btn.disabled', 'Next button is disabled');
      });
    },
    clickIfExists: function(cssSelector) {
      return new this.constructor(this, function() {
        return this.parent
          .findAllByCssSelector(cssSelector).then(function(elements) {
            if (elements.length === 1) {
              elements[0].click();
            }
          }).end();
      });
    },
    deleteCluster: function(modal) {
      return new this.constructor(this, function() {
        return this.parent
          .clickIfExists('a.dashboard.cluster-tab')

          .clickIfExists('.btn-danger')
          .then(function() {
            modal.waitToClose();
          })

          .clickIfExists('button.delete-environment-btn')
          .then(function() {
            modal.waitToOpen();
          })

          .clickIfExists('button.remove-cluster-btn')
          .then(function() {
            modal.waitToClose();
          });
      });
    },
    clickObjectByIndex: function(objectsCssSelector, index) {
      return new this.constructor(this, function() {
        return this.parent
          .findAllByCssSelector(objectsCssSelector).then(function(elements) {
            if (index < 0) {
              index = elements.length + index;
            }
            elements[index].click();
          }).end();
      });
    },
    expandNICPropertyByIndex: function(cssPropLabel, index) {
      return new this.constructor(this, function() {
        return this.parent
          .clickObjectByIndex(cssPropLabel + ' button', index);
      });
    },
    selectNodeByIndex: function(nodeIndex) {
      return new this.constructor(this, function() {
        return this.parent
          .clickObjectByIndex('div.node-list.row div:nth-child(2) div.checkbox-group.pull-left',
                              nodeIndex);
      });
    },
    bondInterfaces: function(itfIndex1, itfIndex2) {
      var itfList = '.ifc-list > div .ifc-header .common-ifc-name .custom-tumbler';
      return new this.constructor(this, function() {
        return this.parent
          .clickObjectByIndex(itfList, itfIndex1)
          .clickObjectByIndex(itfList, itfIndex2)
          .clickByCssSelector('.btn-bond');
      });
    },
    assertAmountMatches: function(cssSelector1, cssSelector2, message) {
      return new this.constructor(this, function() {
        var amount;
        return this.parent
          .findAllByCssSelector(cssSelector1).then(function(elements) {
            amount = elements.length;
          }).end()
          .findAllByCssSelector(cssSelector2).then(function(elements) {
            return assert.equal(elements.length, amount, message);
          }).end();
      });
    },
    applyItfChanges: function() {
      return new this.constructor(this, function() {
        return this.parent
          .assertElementEnabled('button.btn-apply', 'Apply is disabled')
          .clickByCssSelector('button.btn-apply')
          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000);
      });
    },
    assertInputValueEquals: function(cssSelector, value, message) {
      return new this.constructor(this, function() {
        return this.parent
          .findAllByCssSelector(cssSelector).getProperty('value').then(function(el) {
            return assert.equal(el[0], value, message);
          }).end();
      });
    },
  });
});
