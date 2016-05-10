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

class DashboardLib {
  constructor(remote) {
    this.remote = remote;
    this.modal = new ModalWindow(remote);
    this.deployButtonSelector = '.actions-panel .deploy-btn';
    this.stopDeployBtn = 'button.stop-deployment-btn';
    this.textWarningSelector = '.display-changes-dialog > div ';
  }

  checkWarningNotContainsNote(warningText) {
    var firstWarning = '> :nth-child(1) .instruction';
    var secondWarning = '> :nth-child(2) .instruction';
    return this.remote
      .clickByCssSelector(this.deployButtonSelector)
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Deploy Changes'))
      .assertElementNotContainsText(this.textWarningSelector + firstWarning, warningText,
              'Warning does not contain a note about configuration changes')
      .assertElementNotContainsText(this.textWarningSelector + secondWarning, warningText,
              'Warning does not contain a note about configuration changes')
      .then(() => this.modal.clickFooterButton('Cancel'))
      .then(() => this.modal.waitToClose());
  }

  checkWarningContainsNote(warningText) {
    var warningSelector = '.instruction';
    return this.remote
      .clickByCssSelector(this.deployButtonSelector)
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Deploy Changes'))
      .assertElementContainsText(warningSelector, warningText,
              'Warning does not contain a note about configuration changes')
      .then(() => this.modal.clickFooterButton('Cancel'))
      .then(() => this.modal.waitToClose());
  }
}

export default DashboardLib;
