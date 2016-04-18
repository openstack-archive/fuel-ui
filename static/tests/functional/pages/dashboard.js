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
    var self = this;
    return this.remote
      .clickByCssSelector(this.deployButtonSelector)
      .then(() => self.modal.waitToOpen())
      .then(() => self.modal.checkTitle('Deploy Changes'))
      .then(() => self.modal.clickFooterButton('Deploy'))
      .then(() => self.modal.waitToClose());
  },
  stopDeployment: function() {
    var self = this;
    return this.remote
      .clickByCssSelector('button.stop-deployment-btn')
      .then(() => self.modal.waitToOpen())
      .then(() => self.modal.checkTitle('Stop Deployment'))
      .then(() => self.modal.clickFooterButton('Stop'))
      .then(() => self.modal.waitToClose());
  },
  startClusterRenaming: function() {
    return this.remote
      .clickByCssSelector('.cluster-info-value.name .glyphicon-pencil');
  },
  setClusterName: function(name) {
    var self = this;
    return this.remote
      .then(() => self.startClusterRenaming())
      .findByCssSelector('.rename-block input[type=text]')
        .clearValue()
        .type(name)
        // Enter
        .type('\uE007')
        .end()
      .waitForElementDeletion('.rename-block input[type=text]', 2000);
  },
  discardChanges: function() {
    var self = this;
    return this.remote
      .clickByCssSelector('.btn-discard-changes')
      .then(() => self.modal.waitToOpen())
      .then(() => self.modal.clickFooterButton('Discard'))
      .then(() => self.modal.waitToClose());
  }
};

export default DashboardPage;

