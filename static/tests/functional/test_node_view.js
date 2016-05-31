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
import NodeComponent from 'tests/functional/pages/node';
import ModalWindow from 'tests/functional/pages/modal';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import SettingsPage from 'tests/functional/pages/settings';
import 'tests/functional/helpers';

registerSuite(() => {
  var common, node, modal, clusterPage, settingsPage, clusterName;
  var nodeNewName = 'Node new name';

  return {
    name: 'Node view tests',
    setup() {
      common = new Common(this.remote);
      node = new NodeComponent(this.remote);
      modal = new ModalWindow(this.remote);
      clusterPage = new ClusterPage(this.remote);
      settingsPage = new SettingsPage(this.remote);
      clusterName = common.pickRandomName('Test Cluster');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName));
    },
    'Standard node panel'() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .assertElementExists('label.standard.active', 'Standard mode chosen by default')
        .assertElementExists('.node .role-list', 'Role list is shown on node standard panel')
        .clickByCssSelector('.node input[type=checkbox]')
        .assertElementExists('.node.selected', 'Node gets selected upon clicking')
        .assertElementExists('button.btn-delete-nodes:not(:disabled)', 'Delete Nodes and ...')
        .assertElementExists('button.btn-edit-roles:not(:disabled)',
          '... Edit Roles buttons appear upon node selection')
        .then(() => node.renameNode(nodeNewName))
        .assertElementTextEquals('.node .name p', nodeNewName, 'Node name has been updated')
        .clickByCssSelector('.node .btn-view-logs')
        .assertElementAppears('.logs-tab', 2000, 'Check redirect to Logs tab')
        .then(() => clusterPage.goToTab('Nodes'))
        .assertElementAppears('.node-list', 2000, 'Cluster node list loaded')
        .then(() => node.discardNode())
        .assertElementNotExists('.node', 'Node has been removed');
    },
    'Node pop-up'() {
      var newHostname = 'node-123';
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => node.openNodePopup())
        .assertElementTextEquals('.modal-header h4.modal-title', nodeNewName,
          'Node pop-up has updated node name')
        .assertElementExists('.modal .btn-edit-disks', 'Disks can be configured for cluster node')
        .assertElementExists('.modal .btn-edit-networks',
          'Interfaces can be configured for cluster node')
        .assertElementExists('.modal .management-ip', 'Management IP is visible')
        .clickByCssSelector('.change-hostname .btn-link')
        // change the hostname
        .findByCssSelector('.change-hostname [type=text]')
          .clearValue()
          .type(newHostname)
          .pressKeys('\uE007')
          .end()
        .assertElementDisappears('.change-hostname [type=text]', 2000,
          'Hostname input disappears after submit')
        .assertElementTextEquals('span.node-hostname', newHostname,
          'Node hostname has been updated')
        .then(() => modal.close());
    },
    'Compact node panel'() {
      return this.remote
        // switch to compact view mode
        .clickByCssSelector('label.compact')
        .clickByCssSelector('.compact-node')
        .assertElementExists('.compact-node i.glyphicon-ok', 'Self node is selectable')
        .clickByCssSelector('.compact-node .node-name p')
        .assertElementNotExists('.compact-node .node-name-input',
          'Node can not be renamed from compact panel')
        .assertElementNotExists('.compact-node .role-list',
          'Role list is not shown on node compact panel');
    },
    'Compact node extended view'() {
      var newName = 'Node new new name';
      return this.remote
        .then(() => node.openCompactNodeExtendedView())
        .clickByCssSelector('.node-popover .node-name input[type=checkbox]')
        .assertElementExists('.compact-node .node-checkbox i.glyphicon-ok',
          'Node compact panel is checked')
        .then(() => node.openNodePopup(true))
        .assertElementNotExists('.node-popover', 'Node popover is closed when node pop-up opened')
        .then(() => modal.close())
        .then(() => node.openCompactNodeExtendedView())
        .findByCssSelector('.node-popover')
          .assertElementExists('.role-list', 'Role list is shown in cluster node extended view')
          .assertElementExists('.node-buttons',
          'Cluster node action buttons are presented in extended view')
          .end()
        .then(() => node.renameNode(newName, true))
        .assertElementTextEquals('.node-popover .name p', newName,
          'Node name has been updated from extended view')
        .then(() => node.discardNode(true))
        .assertElementNotExists('.node', 'Node has been removed');
    },
    'Additional tests for Node Attributes'() {
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Settings'))
        .clickLinkByText('Compute')
        .clickByCssSelector('input[type=radio][name=libvirt_type]:not(:checked)')
        .waitForCssSelector('.btn-apply-changes:not(:disabled)', 200)
        .clickByCssSelector('.btn-apply-changes')
        .then(() => settingsPage.waitForRequestCompleted())
        .then(() => clusterPage.goToTab('Nodes'))
        .then(() => node.openCompactNodeExtendedView())
        .then(() => node.openNodePopup(true))
        .clickByCssSelector('#headingattributes')
        .assertElementExists('.node-attributes .btn.discard-changes:disabled',
          'Cancel changes button is disabled')
        .setInputValue('.setting-section-hugepages input[name=dpdk]', '2')
        .assertElementExists('.node-attributes .btn.discard-changes:not(:disabled)',
          'Cancel changes button is enabled')
        .clickByCssSelector('.node-attributes .btn.discard-changes')
        .assertElementTextEquals('.setting-section-hugepages input[name=dpdk]',
          0, 'Input restored default value')
        .setInputValue('.setting-section-hugepages input[name=dpdk]', '5')
        .clickByCssSelector('.node-attributes .btn.apply-changes')
        .assertElementsAppear('.setting-section-hugepages input:not(:disabled)', 2000,
          'Inputs are not disabled after changes were saved successfully')
        .assertElementExists('.node-attributes .btn.discard-changes:disabled',
          'Cancel changes button is disabled after changes were saved successfully')
        .then(() => modal.close());
    },
    'Additional tests for unallocated node'() {
      return this.remote
        .clickByCssSelector('.btn-add-nodes')
        .waitForElementDeletion('.btn-add-nodes', 3000)
        .assertElementsAppear('.node', 3000, 'Unallocated nodes loaded')
        .then(() => node.openCompactNodeExtendedView())
        .assertElementNotExists('.node-popover .role-list',
          'Unallocated node does not have roles assigned')
        .assertElementNotExists('.node-popover .node-buttons .btn',
          'There are no action buttons in unallocated node extended view')
        .then(() => node.openNodePopup(true))
        .assertElementNotExists('.modal .btn-edit-disks',
          'Disks can not be configured for unallocated node')
        .assertElementNotExists('.modal .btn-edit-networks',
          'Interfaces can not be configured for unallocated node')
        .assertElementNotExists('.modal .management-ip',
          'Management IP is not visible for unallocated node')
        .then(() => modal.close());
    }
  };
});

