/*
 * Copyright 2015 Mirantis, Inc.
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
import ModalWindow from 'tests/functional/pages/modal';
import 'tests/functional/helpers';

function ClustersPage(remote) {
  this.remote = remote;
  this.modal = new ModalWindow(remote);
}

ClustersPage.prototype = {
  constructor: ClustersPage,
  createCluster: function(clusterName, stepsMethods) {
    var stepMethod = (stepName) => _.bind(_.get(stepsMethods, stepName, _.noop), this);
    return this.remote
      .clickByCssSelector('.create-cluster')
      .then(() => this.modal.waitToOpen())
      // Name and release
      .setInputValue('[name=name]', clusterName)
      .then(stepMethod('Name and Release'))
      .pressKeys('\uE007')
      // Compute
      .then(stepMethod('Compute'))
      .pressKeys('\uE007')
      // Networking Setup
      .then(stepMethod('Networking Setup'))
      .pressKeys('\uE007')
      //Storage Backends
      .then(stepMethod('Storage Backends'))
      .pressKeys('\uE007')
      // Additional Services
      .then(stepMethod('Additional Services'))
      .pressKeys('\uE007')
      // Finish
      .pressKeys('\uE007')
      .then(() => this.modal.waitToClose());
  },
  clusterSelector: '.clusterbox div.name',
  goToEnvironment: function(clusterName) {
    return this.remote
      .waitForCssSelector(this.clusterSelector, 5000)
      .findAllByCssSelector(this.clusterSelector)
      .then(
        (divs) => divs.reduce(
          (matchFound, element) => element.getVisibleText()
            .then((name) => {
              if (name === clusterName) {
                element.click();
                return true;
              }
              return matchFound;
            }),
          false
        )
      )
      .then((result) => {
        if (!result) {
          throw new Error('Cluster ' + clusterName + ' not found');
        }
        return true;
      })
      .end()
      .waitForCssSelector('.dashboard-tab', 1000);
  }
};

export default ClustersPage;
