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

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import ModalWindow from 'tests/functional/pages/modal';

registerSuite(() => {
  var common,
    modal;

  return {
    name: 'Notifications',
    setup() {
      common = new Common(this.remote);
      modal = new ModalWindow(this.remote);

      return this.remote.then(() => common.getIn());
    },
    'Notification Page'() {
      return this.remote
        .assertElementDisplayed('.notifications-icon .badge',
          'Badge notification indicator is shown in navigation')
        // Go to Notification page
        .clickByCssSelector('.notifications-icon')
        .clickLinkByText('View all')
        .assertElementAppears('.notifications-page', 2000, 'Notification page is rendered')
        .assertElementExists('.notifications-page .notification',
          'There is the start notification on the page')
        .assertElementTextEquals('.notification-group .title', 'Today',
          'Notification group has "Today" label')
        .assertElementNotDisplayed('.notifications-icon .badge',
          'Badge notification indicator is hidden');
    },
    'Notification badge behaviour'() {
      var clusterName = common.pickRandomName('Test Cluster');
      return this.remote
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Cinder']))
        // Just in case - reset and hide badge notification counter by clicking on it
        .clickByCssSelector('.notifications-icon')
        .then(() => common.removeCluster(clusterName))
        .assertElementAppears('.notifications-icon .badge.visible', 5000,
          'New notification appear after the cluster removal')
        .clickByCssSelector('.notifications-icon')
        .assertElementAppears('.notifications-popover .notification.clickable', 20000,
          'Discovered node notification uploaded')
        // Check if Node Information dialog is shown
        .clickByCssSelector('.notifications-popover .notification.clickable p')
        .then(() => modal.waitToOpen())
        // Dialog with node information is open
        .assertElementContainsText('.modal-body .node-summary .change-hostname span', 'node',
          'Node summary Hostname contains "node" text');
    }
  };
});
