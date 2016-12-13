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

import _ from 'intern/dojo/node!lodash';
import childProcess from 'intern/dojo/node!child_process';
import Command from 'intern/dojo/node!leadfoot/Command';
import 'tests/functional/helpers';
import assert from 'intern/chai!assert';

_.defaults(Command.prototype, {
  updatePlugin(files) {
    return new this.constructor(this, function() {

      return this.parent
        .then(() => {
          childProcess.exec('/bin/bash ${SCRIPT_PATH} ' + files,
            (err) => {
              if (err) return;
            });
        })
        .sleep(250);  // wait for plugin update
    });
  },
  newClusterFillName(modal) {
    return new this.constructor(this, function() {
      return this.parent
        .clickByCssSelector('.create-cluster')
        .then(() => modal.waitToOpen())
        .setInputValue('[name=name]', 'Temp');
    });
  },
  newClusterWithPlugin(modal) {
    return new this.constructor(this, function() {
      return this.parent
        .clickByCssSelector('.create-cluster')
        .then(() => modal.waitToOpen())
        .setInputValue('[name=name]', 'Temp')

        .pressKeys('\uE007') // go to Compute
        .pressKeys('\uE007') // Networking
        .pressKeys('\uE007') // Storage
        .pressKeys('\uE007') // Additional Services
        .clickByCssSelector('input[name="additional_service:service_plugin_v5_component"]')

        .pressKeys('\uE007') // Finish
        .pressKeys('\uE007') // Create
        .then(() => modal.waitToClose());
    });
  },
  configureInterfacesForNode(modal, nodeNumber) {
    return new this.constructor(this, function() {
      return this.parent
        .clickByCssSelector('div.node-list.row div:nth-child(2) > div:nth-child(' + nodeNumber +
                            ') div.checkbox-group.pull-left input')
        .clickByCssSelector('button.btn-configure-interfaces');
    });
  },
  assertNextButtonEnabled() {
    return new this.constructor(this, function() {
      return this.parent
        .assertElementNotExists('button.next-pane-btn.disabled',
                                'Next button is disabled');
    });
  },
  deleteCluster(modal) {
    return new this.constructor(this, function() {
      return this.parent
        .clickByCssSelector('button.delete-environment-btn')
        .then(() => modal.waitToOpen())
        .clickByCssSelector('button.remove-cluster-btn')
        .then(() => modal.waitToClose());
    });
  },
  selectPluginNICPropertyByNumber(modal, number) {
    return new this.constructor(this, function() {
      return this.parent
        .clickByCssSelector('.ifc-list > div:nth-child(' + number +
                            ') .fuel_plugin_example_v5 > button');
    });
  },
  assertAmountMatches(cssSelector1, cssSelector2, message) {
    return new this.constructor(this, function () {
      var amount;
      return this.parent
        .findAllByCssSelector(cssSelector1).then(function (elements1) {
          amount = elements1.length;
        }).end()
        .findAllByCssSelector(cssSelector2).then(function (elements) {
          if (!_.isNumber(amount)) {
            // no amount given - check if any amount of such elements exist
            message = amount;
            return assert.ok(elements.length, message);
          } else {
            return assert.equal(elements.length, amount, message);
          }
        }).end();
    });
  },
});
