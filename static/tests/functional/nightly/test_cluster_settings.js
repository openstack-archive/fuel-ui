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

import registerSuite from 'intern!object';
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import SettingsLib from 'tests/functional/nightly/library/settings';

registerSuite(() => {
  var common,
    clusterPage,
    clusterName,
    settingsLib;

  return {
    name: 'Settings Tab Segment',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      settingsLib = new SettingsLib(this.remote);
      clusterName = common.pickRandomName('VLAN Cluster');

      return this.remote
        .then(common.getIn)
        .then(() => common.createCluster(clusterName))
        .then(() => clusterPage.goToTab('Settings'));
    },
    'Check "General" segment'() {
      var pageTitleSelector = 'div.title';
      var segmentSelector = 'li.active a.subtab-link-general';
      return this.remote
        .assertElementMatchesRegExp(pageTitleSelector, /OpenStack Settings/i,
          'OpenStack Settings page has default name')
        .assertElementsExist(segmentSelector, 'General Settings segment link exists and active')
        .assertElementMatchesRegExp(segmentSelector, /General/i,
          'General Settings segment link name is correct')
        .then(settingsLib.checkGeneralSegment)
        .assertElementEnabled('button.btn-load-defaults', '"Load Defaults" button is enabled')
        .assertElementDisabled('button.btn-revert-changes', '"Cancel Changes" button is disabled')
        .assertElementDisabled('button.btn-apply-changes', '"Save Settings" button is disabled');
    },
    'Check "Security" segment'() {
      var segmentName = 'Security';
      return this.remote
        .then(() => settingsLib.gotoOpenStackSettings(segmentName))
        .then(settingsLib.checkSecuritySegment);
    },
    'Check "Compute" segment'() {
      var segmentName = 'Compute';
      return this.remote
        .then(() => settingsLib.gotoOpenStackSettings(segmentName))
        .then(settingsLib.checkComputeSegment);
    },
    'Check "Storage" segment'() {
      var segmentName = 'Storage';
      return this.remote
        .then(() => settingsLib.gotoOpenStackSettings(segmentName))
        .then(settingsLib.checkStorageSegment);
    },
    'Check "Logging" segment'() {
      var segmentName = 'Logging';
      return this.remote
        .then(() => settingsLib.gotoOpenStackSettings(segmentName))
        .then(settingsLib.checkLoggingSegment);
    },
    'Check "OpenStack Services" segment'() {
      var segmentName = 'OpenStack Services';
      return this.remote
        .then(() => settingsLib.gotoOpenStackSettings(segmentName))
        .then(settingsLib.checkOpenStackServicesSegment);
    },
    'Check "Other" segment'() {
      var segmentName = 'Other';
      return this.remote
        .then(() => settingsLib.gotoOpenStackSettings(segmentName))
        .then(settingsLib.checkOtherSegment);
    },
    'User returns to the selected segment on "Settings" tab'() {
      return this.remote
        .then(() => clusterPage.goToTab('Nodes'))
        .assertElementsAppear('a.nodes.active', 2000, '"Nodes" tab is opened')
        .then(() => clusterPage.goToTab('Settings'))
        .assertElementsAppear('a.settings.active', 2000, '"Settings" tab is opened')
        .assertElementsExist('div.other', '"Other" settings segment page is opened')
        .assertElementsExist('li.active a.subtab-link-other',
          '"Other" settings segment link exists and active')
        .assertElementMatchesRegExp('li.active a.subtab-link-other', /Other/i,
          '"Other" settings segment link name is correct')
        .then(settingsLib.checkOtherSegment);
    },
    'No "Node network group" item via sorting/filtering for unallocated nodes'() {
      var itemName = 'Node network group';
      var itemRegExp = RegExp('[\\s\\S]*[^(' + itemName + ')][\\s\\S]*', 'i');
      var btnSortSelector = 'button.btn-sorters:enabled';
      var btnFilterSelector = 'button.btn-filters:enabled';
      var btnMoreSelector = 'div.more-control button.btn-link';
      var popoverSelector = 'div.popover ';
      var popContentSelector = popoverSelector + 'div.popover-content div';
      return this.remote
        .then(() => clusterPage.goToTab('Nodes'))
        .assertElementsAppear('a.nodes.active', 2000, '"Nodes" tab is opened')
        .assertElementsExist('button.btn-add-nodes', '"Add Nodes" button exists')
        .clickByCssSelector('button.btn-add-nodes')
        // Check sorting
        .assertElementsAppear(btnSortSelector, 1000, '"Sort Nodes" button exists')
        .clickByCssSelector(btnSortSelector)
        .assertElementsAppear('div.sorters', 1000, '"Sort" pane appears')
        .assertElementsExist(btnMoreSelector, '"More" sort button exists')
        .clickByCssSelector(btnMoreSelector)
        .assertElementsAppear(popoverSelector, 1000, '"More" sort popover appears')
        .assertElementNotExists('input[label="' + itemName + '"]', 'No "' + itemName +
          '" item checkbox via sorting for unallocated nodes')
        .assertElementMatchesRegExp(popContentSelector, itemRegExp, 'No "' + itemName +
          '" item label via sorting for unallocated nodes')
        // Check filtering
        .assertElementsAppear(btnFilterSelector, 1000, '"Filter Nodes" button exists')
        .clickByCssSelector(btnFilterSelector)
        .assertElementsAppear('div.filters', 1000, '"Filter" pane appears')
        .assertElementsExist(btnMoreSelector, '"More" filter button exists')
        .clickByCssSelector(btnMoreSelector)
        .assertElementsAppear(popoverSelector, 1000, '"More" filter popover appears')
        .assertElementNotExists('input[label="' + itemName + '"]', 'No "' + itemName +
          '" item checkbox via filtering for unallocated nodes')
        .assertElementMatchesRegExp(popContentSelector, itemRegExp, 'No "' + itemName +
          '" item label via filtering for unallocated nodes');
    },
    'Check node roles edition'() {
      var nodeSelector = 'div.node ';
      var btnEditSelector = 'button.btn-edit-roles';
      var btnApplySelector = 'button.btn-apply';
      var roleBaseOsSelector = 'div.role-block.base-os';
      var rolesRegExp = RegExp('[\\s\\S]*(controller.*|base-os.*){2}[\\s\\S]*', 'i');
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .assertElementsAppear(nodeSelector + 'input', 1000, '"Controller" node appears')
        .clickByCssSelector(nodeSelector + 'input')
        .assertElementsExist(btnEditSelector, '"Edit Roles" button exists')
        .clickByCssSelector(btnEditSelector)
        .assertElementsAppear(roleBaseOsSelector, 1000, '"Operating System" role appears')
        .clickByCssSelector(roleBaseOsSelector)
        .assertElementsExist(btnApplySelector, '"Apply Changes" button exists')
        .clickByCssSelector(btnApplySelector)
        .waitForElementDeletion(btnApplySelector, 2000)
        .assertElementMatchesRegExp(nodeSelector + 'div.role-list', rolesRegExp,
          '"Controller" and "Operating System" node roles are observed');
    }
  };
});

