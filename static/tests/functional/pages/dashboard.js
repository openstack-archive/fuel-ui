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

import ModalWindow from 'tests/functional/pages/modal';
import 'tests/functional/helpers';

function DashboardPage(remote) {
  this.remote = remote;
  this.modal = new ModalWindow(remote);
  this.deployButtonSelector = '.actions-panel .deploy-btn';
}

DashboardPage.prototype = {
  constructor: DashboardPage,
  startDeployment: function() {
    return this.remote
      .clickByCssSelector(this.deployButtonSelector)
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Deploy Changes'))
      .then(() => this.modal.clickFooterButton('Deploy'))
      .then(() => this.modal.waitToClose());
  },
  stopDeployment: function() {
    return this.remote
      .clickByCssSelector('button.stop-deployment-btn')
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Stop Deployment'))
      .then(() => this.modal.clickFooterButton('Stop'))
      .then(() => this.modal.waitToClose());
  },
  startClusterRenaming: function() {
    return this.remote
      .clickByCssSelector('.cluster-info-value.name .glyphicon-pencil');
  },
  setClusterName: function(name) {
    return this.remote
      .then(() => this.startClusterRenaming())
      .findByCssSelector('.rename-block input[type=text]')
        .clearValue()
        .type(name)
        // Enter
        .type('\uE007')
        .end()
      .waitForElementDeletion('.rename-block input[type=text]', 2000);
  },
  discardChanges: function() {
    return this.remote
      .clickByCssSelector('.btn-discard-changes')
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.clickFooterButton('Discard'))
      .then(() => this.modal.waitToClose());
  }
};

export default DashboardPage;

