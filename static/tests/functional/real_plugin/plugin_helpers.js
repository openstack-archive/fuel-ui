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
  updatePlugin(params) {
    return new this.constructor(this, function() {
      return this.parent
        .then(() => {
          childProcess.exec('/bin/bash ${SCRIPT_PATH} ' + params,
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
  assertNextButtonEnabled() {
    return new this.constructor(this, function() {
      return this.parent
        .assertElementNotExists('button.next-pane-btn.disabled', 'Next button is disabled');
    });
  },
  clickIfExists(cssSelector) {
    return new this.constructor(this, function() {
      return this.parent
        .findAllByCssSelector(cssSelector).then((elements) => {
          if (elements.length === 1) {
            elements[0].click();
          }
        }).end();
    });
  },
  deleteCluster(modal) {
    return new this.constructor(this, function() {
      return this.parent
        .clickIfExists('.btn-revert-changes')
        .clickIfExists('.discard-changes')
        .clickIfExists('a.dashboard.cluster-tab')

        .clickIfExists('.btn-danger')
        .then(() => modal.waitToClose())

        .clickIfExists('button.delete-environment-btn')
        .then(() => modal.waitToOpen())

        .clickIfExists('button.remove-cluster-btn')
        .then(() => modal.waitToClose());
    });
  },
  clickObjectByIndex(objectsCssSelector, index) {
    return new this.constructor(this, function() {
      return this.parent
        .findAllByCssSelector(objectsCssSelector).then((elements) => {
          if (index < 0) {
            index = elements.length + index;
          }
          elements[index].click();
        }).end();
    });
  },
  expandNICPropertyByIndex(cssPropLabel, index) {
    return new this.constructor(this, function() {
      return this.parent
        .clickObjectByIndex(cssPropLabel + ' button', index);
    });
  },
  selectNodeByIndex(nodeIndex) {
    return new this.constructor(this, function() {
      return this.parent
        .clickObjectByIndex('div.node-list.row div:nth-child(2) div.checkbox-group.pull-left',
                            nodeIndex);
    });
  },
  bondInterfaces(itfIndex1, itfIndex2) {
    var itfList = '.ifc-list > div .ifc-header .common-ifc-name .custom-tumbler';
    return new this.constructor(this, function() {
      return this.parent
        .clickObjectByIndex(itfList, itfIndex1)
        .clickObjectByIndex(itfList, itfIndex2)
        .clickByCssSelector('.btn-bond');
    });
  },
  assertAmountMatches(cssSelector1, cssSelector2, message) {
    return new this.constructor(this, () => {
      var amount;
      return this.parent
        .findAllByCssSelector(cssSelector1).then((elements) => {
          amount = elements.length;
        }).end()
        .findAllByCssSelector(cssSelector2).then((elements) => {
          return assert.equal(elements.length, amount, message);
        }).end();
    });
  },
  applyItfChanges() {
    return new this.constructor(this, () => {
      return this.parent
        .assertElementEnabled('button.btn-apply', 'Apply is disabled')
        .clickByCssSelector('button.btn-apply')
        .waitForCssSelector('.btn-defaults:not(:disabled)', 1000);
    });
  },
  assertInputValueEquals(cssSelector, value, message) {
    return new this.constructor(this, () => {
      return this.parent
        .findAllByCssSelector(cssSelector).getProperty('value').then((el) => {
          return assert.equal(el[0], value, message);
        }).end();
    });
  }
});
