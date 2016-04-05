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

define([
  'intern!object',
  'intern/chai!assert',
  'tests/functional/pages/node',
  'tests/functional/pages/modal',
  'tests/functional/pages/common',
  'tests/functional/pages/cluster',
  'tests/functional/pages/settings',
  'tests/functional/helpers'
], function(registerSuite, assert, NodeComponent, ModalWindow, Common, ClusterPage, SettingsPage) {
  'use strict';

  registerSuite(function() {
    var common, node, modal, clusterPage, settingsPage, clusterName;
    var nodeNewName = 'Node new name';

    return {
      name: 'Node view tests',
      setup: function() {
        common = new Common(this.remote);
        node = new NodeComponent(this.remote);
        modal = new ModalWindow(this.remote);
        clusterPage = new ClusterPage(this.remote);
        settingsPage = new SettingsPage(this.remote);
        clusterName = common.pickRandomName('Test Cluster');

        return this.remote
          .then(function() {
            return common.getIn();
          })
          .then(function() {
            return common.createCluster(clusterName);
          });
      },
      'Standard node panel': function() {
        return this.remote
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .assertElementExists('label.standard.active', 'Standard mode chosen by default')
          .assertElementExists('.node .role-list', 'Role list is shown on node standard panel')
          .clickByCssSelector('.node input[type=checkbox]')
          .assertElementExists('.node.selected', 'Node gets selected upon clicking')
          .assertElementExists('button.btn-delete-nodes:not(:disabled)', 'Delete Nodes and ...')
          .assertElementExists('button.btn-edit-roles:not(:disabled)',
            '... Edit Roles buttons appear upon node selection')
          .then(function() {
            return node.renameNode(nodeNewName);
          })
          .assertElementTextEquals('.node .name p', nodeNewName, 'Node name has been updated')
          .clickByCssSelector('.node .btn-view-logs')
          .assertElementAppears('.logs-tab', 2000, 'Check redirect to Logs tab')
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .assertElementAppears('.node-list', 2000, 'Cluster node list loaded')
          .then(function() {
            return node.discardNode();
          })
          .assertElementNotExists('.node', 'Node has been removed');
      },
      'Node pop-up': function() {
        var newHostname = 'node-123';
        return this.remote
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .then(function() {
            return node.openNodePopup();
          })
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
          .then(function() {
            return modal.close();
          });
      },
      'Compact node panel': function() {
        return this.remote
          // switch to compact view mode
          .clickByCssSelector('label.compact')
          .findByCssSelector('.compact-node div.node-checkbox')
            .click()
            .assertElementExists('i.glyphicon-ok', 'Self node is selectable')
            .end()
          .clickByCssSelector('.compact-node .node-name p')
          .assertElementNotExists('.compact-node .node-name-input',
            'Node can not be renamed from compact panel')
          .assertElementNotExists('.compact-node .role-list',
            'Role list is not shown on node compact panel');
      },
      'Compact node extended view': function() {
        var newName = 'Node new new name';
        return this.remote
          .then(function() {
            return node.openCompactNodeExtendedView();
          })
          .clickByCssSelector('.node-popover .node-name input[type=checkbox]')
          .assertElementExists('.compact-node .node-checkbox i.glyphicon-ok',
            'Node compact panel is checked')
          .then(function() {
            return node.openNodePopup(true);
          })
          .assertElementNotExists('.node-popover', 'Node popover is closed when node pop-up opened')
          .then(function() {
            // close node pop-up
            return modal.close();
          })
          .then(function() {
            return node.openCompactNodeExtendedView();
          })
          .findByCssSelector('.node-popover')
            .assertElementExists('.role-list', 'Role list is shown in cluster node extended view')
            .assertElementExists('.node-buttons',
            'Cluster node action buttons are presented in extended view')
            .end()
          .then(function() {
            return node.renameNode(newName, true);
          })
          .assertElementTextEquals('.node-popover .name p', newName,
            'Node name has been updated from extended view')
          .then(function() {
            return node.discardNode(true);
          })
          .assertElementNotExists('.node', 'Node has been removed');
      },
      'Additional tests for Node Attributes': function() {
        return this.remote
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .then(function() {
            return clusterPage.goToTab('Settings');
          })
          .clickLinkByText('Compute')
          .clickByCssSelector('input[type=radio][name=libvirt_type]:not(:checked)')
          .waitForCssSelector('.btn-apply-changes:not(:disabled)', 200)
          .clickByCssSelector('.btn-apply-changes')
          .then(function() {
            return settingsPage.waitForRequestCompleted();
          })
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .then(function() {
            return node.openCompactNodeExtendedView();
          })
          .then(function() {
            return node.openNodePopup(true);
          })
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
          .then(function() {
            return modal.close();
          });
      },
      'Additional tests for unallocated node': function() {
        return this.remote
          .clickByCssSelector('.btn-add-nodes')
          .waitForElementDeletion('.btn-add-nodes', 3000)
          .assertElementsAppear('.node', 3000, 'Unallocated nodes loaded')
          .then(function() {
            return node.openCompactNodeExtendedView();
          })
          .assertElementNotExists('.node-popover .role-list',
            'Unallocated node does not have roles assigned')
          .assertElementNotExists('.node-popover .node-buttons .btn',
            'There are no action buttons in unallocated node extended view')
          .then(function() {
            return node.openNodePopup(true);
          })
          .assertElementNotExists('.modal .btn-edit-disks',
            'Disks can not be configured for unallocated node')
          .assertElementNotExists('.modal .btn-edit-networks',
            'Interfaces can not be configured for unallocated node')
          .assertElementNotExists('.modal .management-ip',
            'Management IP is not visible for unallocated node')
          .then(function() {
            return modal.close();
          });
      }
    };
  });
});
