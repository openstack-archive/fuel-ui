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
import NodesLib from 'tests/functional/nightly/library/nodes';

registerSuite(() => {
  var common, clusterPage, settingsLib, nodesLib, clusterName;
  var btnAddNodesSelector = '.btn-add-nodes';
  var btnCancelSelector = 'button[class$="btn-default"]';
  var rolePaneSelector = 'div.role-panel ';
  var btnRole = ' div.role';
  var warningIconSelector = ' i.glyphicon-warning-sign';
  var baseGroupSelector = rolePaneSelector + 'div.base ';
  var computeGroupSelector = rolePaneSelector + 'div.compute ';
  var storageGroupSelector = rolePaneSelector + 'div.storage ';
  var otherGroupSelector = rolePaneSelector + 'div.other ';
  // R = Role selector
  var controlR = baseGroupSelector + 'div.controller';
  var computeR = computeGroupSelector + 'div.compute';
  var virtualR = computeGroupSelector + 'div.virt';
  var ironicR = computeGroupSelector + 'div.ironic';
  var cinderR = storageGroupSelector + 'div.cinder';
  var cindrBdR = storageGroupSelector + 'div.cinder-block-device';
  var cephOsdR = storageGroupSelector + 'div.ceph-osd';
  var mongoDbR = otherGroupSelector + 'div.mongo';
  var baseOsR = otherGroupSelector + 'div.base-os';
  // N = Name
  var controlN = 'Controller';
  var computeN = 'Compute';
  var virtualN = 'Virtual';
  var ironicN = 'Ironic';
  var cinderN = 'Cinder';
  var cindrBdN = 'Cinder Block Device';
  var cephOsdN = 'Ceph OSD';
  var mongoDbN = 'Telemetry - MongoDB';
  var baseOsN = 'Operating System';
  // P = Popup value
  var popupSelector = 'div.popover';
  var controlP = 'The Controller initiates orchestration activities and provides an external ' +
    'API. Other components like Glance.*image storage.*Keystone.*identity management.*Horizon.*' +
    'OpenStack dashboard.*and Nova-Scheduler are installed on the controller as well';
  var computeP = 'A Compute node creates, manages, and terminates virtual machine instances';
  var virtualP = 'ADVANCED: Make available possibilities to spawn vms on this node that can be ' +
    'assign as a normal nodes';
  var ironicP = 'Ironic conductor';
  var cinderP = 'Cinder provides scheduling of block storage resources, typically delivered over ' +
    'iSCSI and other compatible backend storage systems. Block storage can be used for database ' +
    'storage, expandable file systems, or to provide a server with access to raw block level ' +
    'devices';
  var cindrBdP = 'Host node for Cinder Block Devices';
  var cephOsdP = 'Ceph storage can be configured to provide storage for block volumes.*Cinder.*' +
    'images.*Glance.*and ephemeral instance storage.*Nova.*It can also provide object storage ' +
    'through the S3 and Swift API.*See settings to enable each';
  var mongoDbP = 'A feature-complete and recommended database for storage of metering data from ' +
    'OpenStack Telemetry.*Ceilometer';
  var baseOsP = 'Install base Operating System without additional packages and configuration';
  var shouldP = '.*should be enabled in the environment settings';
  var allP = '[\\s\\S]*';
  // Dictionary init
  var roleSelectors = {};
  var rolePopups = {};
  var warningRoles = [ironicN, cephOsdN, mongoDbN];
  var roleNames =
    [controlN, computeN, virtualN, ironicN, cinderN, cindrBdN, cephOsdN, mongoDbN, baseOsN];
  var roleSels =
    [controlR, computeR, virtualR, ironicR, cinderR, cindrBdR, cephOsdR, mongoDbR, baseOsR];
  var rolePops =
    [controlP, computeP, virtualP, ironicP, cinderP, cindrBdP, cephOsdP, mongoDbP, baseOsP];
  for (let i = 0; i < roleNames.length; i++) {
    roleSelectors[roleNames[i]] = roleSels[i];
    rolePopups[roleNames[i]] = rolePops[i];
  }

  return {
    name: 'Node roles panel',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      settingsLib = new SettingsLib(this.remote);
      nodesLib = new NodesLib(this.remote);
      clusterName = common.pickRandomName('Test Cluster');
      var cinderBlockDeviceDriverSelector = 'input[name="volumes_block_device"]';
      var btnSaveSettingsSelector = '.btn-apply-changes';

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => clusterPage.goToTab('Settings'))
        .then(() => settingsLib.gotoOpenStackSettings('Storage'))
        .clickByCssSelector(cinderBlockDeviceDriverSelector)
        .clickByCssSelector(btnSaveSettingsSelector)
        .waitForCssSelector(cinderBlockDeviceDriverSelector + ':enabled', 1500)
        .then(() => clusterPage.goToTab('Dashboard'))
        .clickByCssSelector(btnAddNodesSelector);
    },
    'Check new node roles grouping'() {
      var nodePaneSelector = 'div.node-list';
      var roleHeight = 316;
      var chain = this.remote;

      chain = chain.assertElementsExist(rolePaneSelector, 'Node roles list pane exists')
      .assertElementsExist(nodePaneSelector, 'Node list pane exists')
      .assertElementPropertyEquals(rolePaneSelector, 'offsetHeight', roleHeight,
        'Node role list pane takes' + roleHeight + 'pixels of height');
      for (let i = 0; i < roleNames.length; i++) {
        chain = chain.assertElementsExist(roleSelectors[roleNames[i]],
          roleNames[i] + ' role is grouped correctly');
      }
      return chain;
    },
    'Check role data observed correctly'() {
      var chain = this.remote;
      chain = chain.then(() => nodesLib.cleanAllPopups());
      for (let i = 0; i < roleNames.length; i++) {
        var popupValue = '';
        if (warningRoles.indexOf(roleNames[i]) !== -1) {
          popupValue = allP + shouldP;
          chain = chain.assertElementsExist(roleSelectors[roleNames[i]] + warningIconSelector,
            roleNames[i] + ' role correctly include warning icon');
        }
        popupValue = RegExp(popupValue + allP + rolePopups[roleNames[i]] + allP, 'i');
        chain = chain.assertElementContainsText(roleSelectors[roleNames[i]], roleNames[i],
          roleNames[i] + ' role name is observed and correct')
        .findByCssSelector(roleSelectors[roleNames[i]])
          .then((element) => this.remote.moveMouseTo(element))
          .end()
        .waitForCssSelector(popupSelector, 1500)
        .assertElementMatchesRegExp(popupSelector, popupValue, roleNames[i] +
          ' role popup is observed with correct info message: "' + popupValue + '"');
      }
      return chain;
    },
    'Check popover messages for different variants of roles intersections'() {
      this.timeout = 45000;
      var intersectionController = [computeN, virtualN, cindrBdN];
      var intersectionCompute = [controlN, ironicN, mongoDbN];
      var intersectionVirtual = [controlN, baseOsN];
      var intersectionCinderBd = [controlN, cinderN, cephOsdN];
      return this.remote
        .then(() => nodesLib.cleanAllPopups())
        .then(() => nodesLib.checkRoleIntersections(controlN, intersectionController, roleSelectors,
          rolePopups, warningRoles))
        .then(() => nodesLib.checkRoleIntersections(computeN, intersectionCompute, roleSelectors,
          rolePopups, warningRoles))
        .then(() => nodesLib.checkRoleIntersections(virtualN, intersectionVirtual, roleSelectors,
          rolePopups, warningRoles))
        .then(() => nodesLib.checkRoleIntersections(cindrBdN, intersectionCinderBd, roleSelectors,
          rolePopups, warningRoles));
    },
    'Check new visual design for different role states'() {
      var btnEditRolesSelector = '.btn-edit-roles';
      var selectAllSelector = 'div.node-list-header input';
      var selectedIconSelector = ' i.glyphicon-selected-role';
      // R = Role
      var selR = '.selected';
      var disR = '.unavailable';
      var hovR = ':hover';
      var nselR = ':not(' + selR + ')';
      var ndisR = ':not(' + disR + ')';
      var nhovR = ':not(' + hovR + ')';
      var indR = nselR + disR + nhovR + '.indeterminated';
      // C = Color
      var whiteC = 'rgba(255, 255, 255, 1)';
      var greyC = 'rgba(217, 217, 217, 1)';
      var blackC = 'rgba(82, 89, 96, 1)';
      var greenC = 'rgba(64, 148, 64, 1)';
      var lgreenC = 'rgba(84, 168, 84, 1)';
      var llgreenC = 'rgba(134, 195, 134, 1)';
      var orangeC = 'rgba(188, 110, 18, 1)';
      var lorangeC = 'rgba(237, 161, 71, 1)';
      return this.remote
        .then(() => nodesLib.cleanAllPopups())
        .assertElementNotExists(rolePaneSelector + selR, 'No one role is selected')
        // Check "Base" role state
        .assertElementsExist(baseOsR + nselR + ndisR + nhovR, baseOsN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(baseOsN, baseOsR, whiteC, greyC, blackC))
        .assertElementsExist(virtualR + nselR + ndisR + nhovR, virtualN + ' role has true state')
        // Check "Hover" role state
        .then(() => nodesLib.waitForPopup(baseOsR))
        .assertElementsExist(baseOsR + nselR + ndisR + hovR, baseOsN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(baseOsN, baseOsR, greyC, greyC, blackC))
        .assertElementsExist(virtualR + nselR + ndisR + nhovR, virtualN + ' role has true state')
        // Check "Selected" and "Hover" role states
        .clickByCssSelector(baseOsR + btnRole)
        .assertElementNotExists(popupSelector, 'Help popup is gone for "Selected" state')
        .assertElementsExist(baseOsR + selectedIconSelector, baseOsN + ' role has selected icon')
        .assertElementsExist(baseOsR + selR + ndisR + hovR, baseOsN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(baseOsN, baseOsR, greenC, greenC, whiteC))
        // Check "Selected" role state
        .then(() => nodesLib.cleanAllPopups())
        .assertElementsExist(baseOsR + selR + ndisR + nhovR, baseOsN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(baseOsN, baseOsR, lgreenC, lgreenC, whiteC))
        // Check "Disabled" role state
        .assertElementsExist(virtualR + warningIconSelector, virtualN + ' role has disabled icon')
        .assertElementsExist(virtualR + nselR + disR + nhovR, virtualN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(virtualN, virtualR, whiteC, lorangeC, orangeC))
        // Check "Disabled" and "Hover" role states and that user cannot select disabled role
        .then(() => nodesLib.waitForPopup(virtualR))
        .clickByCssSelector(virtualR + btnRole)
        .assertElementNotExists(popupSelector, 'Help popup is gone for "Disabled" state')
        .assertElementsExist(virtualR + nselR + disR + hovR, virtualN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(virtualN, virtualR, greyC, greyC, orangeC))
        // Precondition
        .clickByCssSelector(btnCancelSelector)
        .waitForCssSelector(btnAddNodesSelector, 1000)
        .then(() => common.addNodesToCluster(2, [controlN]))
        .then(() => common.addNodesToCluster(1, [computeN]))
        .clickByCssSelector(selectAllSelector)
        .waitForCssSelector(btnEditRolesSelector, 1000)
        .clickByCssSelector(btnEditRolesSelector)
        .waitForCssSelector(controlR, 1000)
        // Check "Indeterminate" role state for "Controller"
        .assertElementsExist(controlR + warningIconSelector, controlN + ' role has disabled icon')
        .assertElementsExist(controlR + indR, controlN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(controlN, controlR, llgreenC, llgreenC, whiteC))
        // Check "Indeterminate" role state for "Compute"
        .assertElementsExist(computeR + warningIconSelector, computeN + ' role has disabled icon')
        .assertElementsExist(computeR + indR, computeN + ' role has true state')
        .then(() => nodesLib.checkRoleColors(computeN, computeR, llgreenC, llgreenC, whiteC));
    }
  };
});
