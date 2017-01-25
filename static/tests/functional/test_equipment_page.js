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
import NodeComponent from 'tests/functional/pages/node';
import ModalWindow from 'tests/functional/pages/modal';

registerSuite(() => {
  var common,
    node,
    modal;

  return {
    name: 'Equipment Page',
    setup() {
      common = new Common(this.remote);
      node = new NodeComponent(this.remote);
      modal = new ModalWindow(this.remote);

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster('Env#1'))
        .then(() => common.addNodesToCluster(2, ['Controller']))
        // go back to Environments page
        .clickLinkByText('Environments')
        .waitForCssSelector('.clusters-page', 2000)
        .then(() => common.createCluster('Env#2'))
        .then(() => common.addNodesToCluster(2, ['Compute', 'Virtual']))
        // go back to Environments page
        .clickLinkByText('Environments')
        .waitForCssSelector('.clusters-page', 2000)
        // go to Equipment page
        .clickLinkByText('Equipment')
        .waitForCssSelector('.equipment-page', 5000);
    },
    'Equipment page is rendered correctly'() {
      return this.remote
        .assertElementsExist('.node', 8, 'All Fuel nodes are presented')
        .assertElementNotExists('.control-buttons-box .btn', 'No management buttons presented')
        .assertElementsExist('.nodes-group', 3, 'The page has default sorting by node status');
    },
    'Check action buttons'() {
      return this.remote
        .assertElementNotExists('.node .btn-discard', 'No discard changes button on a node')
        .assertElementExists('.node.offline .node-remove-button',
          'Removing of offline nodes is available on the page')
        .clickByCssSelector('.node.pending_addition > label')
        .assertElementNotExists('.control-buttons-box .btn',
          'No management buttons for selected online node')
        .clickByCssSelector('.node.offline > label')
        .assertElementExists('.control-buttons-box .btn',
          'Management buttons for selected offline node')
        .assertElementExists('.control-buttons-box .btn-remove-nodes',
          'Only removing of offline nodes is available on the page')
        .assertElementExists('.node-list-management-buttons .btn-labels:not(:disabled)',
          'Nodes can be labelled on the page')
        .assertElementsExist('.node.pending_addition .btn-view-logs', 4,
          'View logs button is presented for assigned to any environment nodes')
        .assertElementNotExists('.node:not(.pending_addition) .btn-view-logs',
          'View logs button is not presented for unallocated nodes')
        .clickByCssSelector('.node .node-settings')
        .then(() => modal.waitToOpen())
        .assertElementNotExists('.btn-edit-disks',
          'No disks configuration buttons in node pop-up')
        .assertElementNotExists('.btn-edit-networks',
          'No interfaces configuration buttons in node pop-up')
        .then(() => modal.close())
        .clickByCssSelector('label.compact')
        .then(() => node.openCompactNodeExtendedView())
        .assertElementNotExists('.node-popover .node-buttons .btn:not(.btn-view-logs)',
          'No action buttons in node extended view in compact mode');
    }
  };
});
