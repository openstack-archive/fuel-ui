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
import DashboardPage from 'tests/functional/pages/dashboard';
import pollUntil from 'intern/dojo/node!leadfoot/helpers/pollUntil';
import 'tests/functional/helpers';

class ClusterPage {
  constructor(remote) {
    this.remote = remote;
    this.modal = new ModalWindow(remote);
    this.dashboardPage = new DashboardPage(remote);
  }

  goToTab(tabName) {
    return this.remote
      .findByCssSelector('.cluster-page .tabs')
        .clickLinkByText(tabName)
        .end()
      .then(
        pollUntil(
          (textToFind) => window.$('.cluster-tab.active').text() === textToFind || null,
          [tabName],
          6000
        )
      );
  }

  removeCluster(clusterName) {
    return this.remote
      .clickLinkByText('Dashboard')
      .clickByCssSelector('button.delete-environment-btn')
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.clickFooterButton('Delete'))
      .findAllByCssSelector('div.confirm-deletion-form input[type=text]')
        .then((confirmInputs) => {
          if (confirmInputs.length) {
            return confirmInputs[0]
              .type(clusterName)
              .then(() => this.modal.clickFooterButton('Delete'));
          }
        })
        .end()
      .then(() => this.modal.waitToClose())
      .waitForCssSelector('.clusters-page', 2000)
      .waitForDeletedByCssSelector('.clusterbox', 20000);
  }

  searchForNode(nodeName) {
    return this.remote
      .clickByCssSelector('button.btn-search')
      .setInputValue('input[name=search]', nodeName);
  }

  checkNodeRoles(assignRoles) {
    return this.remote
      .findAllByCssSelector('.role-panel .role-block .role')
      .then(
        (roles) => roles.reduce(
          (result, role) => role
            .getVisibleText()
            .then((label) => {
              var index = assignRoles.indexOf(label);
              if (index >= 0) {
                role.click();
                assignRoles.splice(index, 1);
                return !assignRoles.length;
              }
            }),
          false
        )
      );
  }

  checkNodes(amount, status) {
    status = status || 'discover';
    return this.remote
      .then(() => _.range(amount).reduce(
          (result, index) => this.remote
            .findAllByCssSelector('.node' + '.' + status + ' > label')
              .then((nodes) => nodes[index].click())
              .catch((e) => {
                throw new Error('Failed to add ' + amount + ' nodes to the cluster: ' + e);
              }),
          true
        )
      );
  }

  resetEnvironment(clusterName) {
    return this.remote
      .clickByCssSelector('button.reset-environment-btn')
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Reset Environment'))
      .then(() => this.modal.clickFooterButton('Reset'))
      .findAllByCssSelector('div.confirm-reset-form input[type=text]')
        .then((confirmationInputs) => {
          if (confirmationInputs.length) {
            return confirmationInputs[0]
              .type(clusterName)
              .then(() => this.modal.clickFooterButton('Reset'));
          }
        })
        .end()
      .then(() => this.modal.waitToClose())
      .waitForElementDeletion('div.progress-bar', 20000);
  }

  isTabLocked(tabName) {
    return this.remote
      .then(() => this.goToTab(tabName))
      .waitForCssSelector('div.tab-content div.row.changes-locked', 2000)
        .then(() => true, () => false);
  }

  deployEnvironment() {
    return this.remote
      .then(() => this.goToTab('Dashboard'))
      .then(() => this.dashboardPage.startDeployment())
      .waitForElementDeletion('.dashboard-block .progress', 60000)
      .waitForCssSelector('.links-block', 5000);
  }
}

export default ClusterPage;
