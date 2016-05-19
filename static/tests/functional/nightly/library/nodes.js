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

import 'tests/functional/helpers';
import ClusterPage from 'tests/functional/pages/cluster';
import ClustersPage from 'tests/functional/pages/clusters';
import GenericLib from 'tests/functional/nightly/library/generic';

function NodesLib(remote) {
  this.remote = remote;
  this.clusterPage = new ClusterPage(remote);
  this.clustersPage = new ClustersPage(remote);
  this.genericLib = new GenericLib(remote);
}

NodesLib.prototype = {
  constructor: NodesLib,
  btnCancelSelector: 'button[class$="btn-default"]',
  popupSelector: 'div.popover',
  warningIconSelector: ' i.glyphicon-warning-sign',

  cleanAllPopups() {
    return this.remote
      .findByCssSelector(this.btnCancelSelector)
        .then((element) => this.remote.moveMouseTo(element))
        .end()
      .assertElementNotExists(this.popupSelector, 'All popups are disappeared');
  },
  waitForPopup(roleSelector) {
    return this.remote
      .findByCssSelector(roleSelector)
        .then((element) => this.remote.moveMouseTo(element))
        .end()
      .assertElementAppears(this.popupSelector, 1500, 'Popup appears');
  },
  checkRoleIntersections(roleName, intersectionNames, roleSelectors, rolePopups, warningRoles) {
    var allP = '[\\s\\S]*';
    var shouldPopup = allP + '.*should be enabled in the environment settings';
    var interPopup = allP + 'This role cannot be combined with the selected roles' + allP;
    var selectedRole = '.selected';
    var btnRole = ' div.role';
    var roleSelector = roleSelectors[roleName];
    var chain = this.remote;

    chain = chain.clickByCssSelector(roleSelector + btnRole)
    .assertElementsExist(roleSelector + selectedRole, roleName + ' role is selected');
    for (let i = 0; i < intersectionNames.length; i++) {
      var popupValue = '';
      if (warningRoles.indexOf(intersectionNames[i]) !== -1) {
        popupValue = shouldPopup;
      }
      popupValue = RegExp(popupValue + interPopup + rolePopups[intersectionNames[i]] + allP, 'i');
      chain = chain.findByCssSelector(roleSelectors[intersectionNames[i]])
        .then((element) => this.remote.moveMouseTo(element))
        .end()
      .waitForCssSelector(this.popupSelector, 1500)
      .assertElementsExist(roleSelectors[intersectionNames[i]] + this.warningIconSelector,
        intersectionNames[i] + ' role correctly include warning icon for intersection')
      .assertElementMatchesRegExp(this.popupSelector, popupValue, intersectionNames[i] +
        ' role popup is observed with correct intersection message: ' + popupValue)
      .then(() => this.cleanAllPopups());
    }
    chain = chain.clickByCssSelector(roleSelector + btnRole)
    .assertElementNotExists(roleSelector + selectedRole, roleName + ' role is not selected')
    .then(() => this.cleanAllPopups());
    return chain;
  },
  checkRoleColors(roleName, roleSelector, backgroundColor, borderColor, textColor) {
    return this.remote
      .findByCssSelector(roleSelector)
        .getComputedStyle('background-color')
        .then((color) => {
          if (color !== backgroundColor) {
            throw new Error(roleName + ' role state has invalid background color: ' + color);
          }
        })
        .getComputedStyle('border-top-color')
        .then((color) => {
          if (color !== borderColor) {
            throw new Error(roleName + ' role state has invalid border color: ' + color);
          }
        })
        .getComputedStyle('color')
        .then((color) => {
          if (color !== textColor) {
            throw new Error(roleName + ' role state has invalid text color: ' + color);
          }
        })
        .end();
  },
  checkDeployResults(contr1N, contr1S, contr2N, contr2S, compN, compS, clusterN, clusterS) {
    // N - Name, S - Status
    var nodeGroupSelector = 'div.nodes-group';
    var nodeSelector = 'div.node.';
    var contr1Sel = nodeGroupSelector + ':first-child ' + nodeSelector + contr1S + ':first-child';
    var contr2Sel = nodeGroupSelector + ':first-child ' + nodeSelector + contr2S + ':last-child';
    var compSel = nodeGroupSelector + ':last-child ' + nodeSelector + compS + ':first-child';
    var nameSelector = ' div.name';
    var statusSelector = ' div.status';
    var clusterSelector = 'a.clusterbox';
    return this.remote
      .then(() => this.clusterPage.goToTab('Nodes'))
      .assertElementsAppear(nodeGroupSelector, 1000, '"Nodes" subpage is not empty')
      .assertElementsExist(contr1Sel, contr1S + ' conroller node #1 exists')
      .assertElementsExist(contr2Sel, contr2S + ' conroller node #2 exists')
      .assertElementsExist(compSel, compS + ' compute node exists')
      .assertElementContainsText(contr1Sel + nameSelector, contr1N,
        contr1S + ' conroller node #1 has correct name')
      .assertElementContainsText(contr2Sel + nameSelector, contr2N,
        contr2S + ' conroller node #2 has correct name')
      .assertElementContainsText(compSel + nameSelector, compN,
        compS + ' compute node has correct name')
      .then(() => this.genericLib.gotoPage('Environments'))
      .assertElementsAppear(clusterSelector, 1000, '"Cluster" page is not empty')
      .assertElementContainsText(clusterSelector + nameSelector, clusterN,
        'Cluster has correct name')
      .assertElementContainsText(clusterSelector + statusSelector, clusterS,
        'Cluster has correct status')
      .then(() => this.clustersPage.goToEnvironment(clusterN));
  }
};

export default NodesLib;
