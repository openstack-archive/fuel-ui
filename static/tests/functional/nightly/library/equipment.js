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

import ModalWindow from 'tests/functional/pages/modal';
import GenericLib from 'tests/functional/nightly/library/generic';
import 'tests/functional/helpers';

class EquipmentLib {
  constructor(remote) {
    this.remote = remote;
    this.modal = new ModalWindow(remote);
    this.generic = new GenericLib(remote);
    this.nodeSelector = 'div.node';
    this.managementIpSelector = 'div.node-summary div.management-ip';
    this.publicIpSelector = 'div.node-summary div.public-ip';
    this.txtSearchSelector = 'input[name="search"]';
    this.groupSelector = 'div.nodes-group';
  }

  checkNodesSegmentation(nodeView, nodesQuantity, isReadyCluster) {
    // Input array: Nodes quantity by groups.
    // [Total, Pending Addition (Ready), Discover, Error, Offline]
    var nodeSel = this.nodeSelector;
    var tempSelector = '.';
    var clusterSelector = 'pending_addition';
    if (nodeView === 'compact') {
      nodeSel = 'div.compact-node';
      tempSelector = ' div.';
    } else if (nodeView !== 'standard') {
      throw new Error('Invalid input value. Check nodeView: "' + nodeView +
        '" parameter and restart test.');
    }
    if (isReadyCluster) {
      clusterSelector = 'ready';
    }
    return this.remote
      .assertElementsAppear(nodeSel, 1000, '"' + nodeView + ' Node" view is loaded')
      .assertElementsExist(nodeSel, nodesQuantity[0],
        'Default nodes quantity is observed')
      .assertElementsExist(nodeSel + tempSelector + clusterSelector, nodesQuantity[1],
        '"Pending Addition/Ready" nodes are observed in "' + nodeView + '" view')
      .assertElementsExist(nodeSel + tempSelector + 'discover', nodesQuantity[2],
        '"Discovered" nodes are observed in "' + nodeView + '" view')
      .assertElementsExist(nodeSel + tempSelector + 'error', nodesQuantity[3],
        '"Error" nodes are observed in "' + nodeView + '" view')
      .assertElementsExist(nodeSel + tempSelector + 'offline', nodesQuantity[4],
        '"Offline" nodes are observed in "' + nodeView + '" view');
  }

  renameNode(nodeSelector, newName) {
    var nodeNameSelector = 'div.name p';
    var inputSelector = 'input.node-name-input';
    return this.remote
      .assertElementsExist(nodeSelector, 'Node to rename exists')
      .findByCssSelector(nodeSelector)
        .assertElementsExist(nodeNameSelector, 'Node name textlink exists')
        .clickByCssSelector(nodeNameSelector)
        .assertElementsAppear(inputSelector, 500, 'Rename textfield appears')
        .findByCssSelector(inputSelector)
          .clearValue()
          .type(newName)
          .pressKeys('\uE007')
          .end()
        .assertElementsAppear(nodeNameSelector, 1000, 'Node new name textlink appears')
        .assertElementTextEquals(nodeNameSelector, newName, 'Node name is changed successfully')
        .end();
  }

  checkSearchPageSwitching(pageName, nodeName) {
    return this.remote
      .then(() => {
        if (pageName !== 'Equipment') {
          return this.generic.gotoPage(pageName);
        }
      })
      .then(() => this.generic.gotoPage('Equipment'))
      .assertElementsExist(this.nodeSelector, 1,
        'Search result saved after switching to "' + pageName + '"" page')
      .assertElementContainsText(this.nodeSelector + ' div.name p', nodeName,
        'Search result is correct after switching to "' + pageName + '"" page');
  }

  checkSortingPageSwitching(pageName, nodesQuantity) {
    // Input array: Nodes quantity by groups.
    // [Total, Pending Addition, Discover]
    return this.remote
      .then(() => {
        if (pageName !== 'Equipment') {
          return this.generic.gotoPage(pageName);
        }
      })
      .then(() => this.generic.gotoPage('Equipment'))
      .assertElementsExist(this.nodeSelector, nodesQuantity[0],
        'Filtered nodes quantity is observed after switching to "' + pageName + '"" page')
      .assertElementsExist(this.groupSelector, 1,
       'Only "Discovered" node group is correctly filtered ' +
        'after switching to "' + pageName + '"" page')
      .assertElementContainsText(this.groupSelector + ':nth-child(1) h4', 'Discovered',
        '"Discovered" node group is correctly sorted after switching to "' + pageName + '"" page')
      .assertElementsExist(this.groupSelector + ':nth-child(1) div.node.pending_addition',
        nodesQuantity[1], 'Default quantity of "Pending Addition" nodes is observed after' +
        'switching to "' + pageName + '"" page')
      .assertElementsExist(this.groupSelector + ':nth-child(1) div.node.discover',
        nodesQuantity[2], 'Default quantity of "Discovered" nodes is observed ' +
        'after switching to "' + pageName + '"" page');
  }

  checkDefaultSorting(sortDirection, nodesQuantity) {
    // Input array: Nodes quantity by groups.
    // [Total, Pending Addition, Discover, Error, Offline]
    var childGroupSelector = this.groupSelector + ':nth-child(';
    var orderName, sortOrder, sortSelector;
    if (sortDirection === 'down') {
      sortOrder = [1, 2, 3];
      orderName = 'asc';
    } else if (sortDirection === 'up') {
      sortOrder = [3, 2, 1];
      orderName = 'desc';
    } else {
      throw new Error('Invalid sort direction value. Check sortDirection: "' + sortDirection +
        '" parameter and restart test.');
    }
    sortSelector = 'div.sort-by-status-' + orderName;
    return this.remote
      .assertElementsExist(sortSelector, 'Status sorting block is observed')
      .findByCssSelector(sortSelector)
        .assertElementContainsText('button.btn-default', 'Status', 'Sorting by status is default')
        .assertElementsExist('i.glyphicon-arrow-' + sortDirection,
          'Sorting in ' + orderName + ' order is observed')
        .end()
      .assertElementsExist(this.nodeSelector, nodesQuantity[0],
        'Default nodes quantity is observed')
      .assertElementContainsText(childGroupSelector + sortOrder[0] + ') h4', 'Discovered',
        '"Discovered" node group is correctly sorted')
      .assertElementsExist(childGroupSelector + sortOrder[0] + ') div.node.pending_addition',
        nodesQuantity[1], 'Default quantity of "Pending Addition" nodes is observed')
      .assertElementsExist(childGroupSelector + sortOrder[0] + ') div.node.discover',
        nodesQuantity[2], 'Default quantity of "Discovered" nodes is observed')
      .assertElementContainsText(childGroupSelector + sortOrder[1] + ') h4', 'Error',
        '"Error" node group is correctly sorted')
      .assertElementsExist(childGroupSelector + sortOrder[1] + ') div.node.error',
        nodesQuantity[3], 'Default quantity of "Error" nodes is observed')
      .assertElementContainsText(childGroupSelector + sortOrder[2] + ') h4', 'Offline',
        '"Offline" node group is correctly sorted')
      .assertElementsExist(childGroupSelector + sortOrder[2] + ') div.node.offline',
        nodesQuantity[4], 'Default quantity of "Offline" nodes is observed');
  }

  uncheckNodeRoles() {
    var selectedRolesSelector = '.role-panel .role-block .role i.glyphicon-selected-role';
    return this.remote
      .findAllByCssSelector(selectedRolesSelector)
      .then((nodes) => {
        nodes.forEach((node) => {
          node.click();
        });
      })
      .end();
  }

  checkGenericIpValues(nodeSelector, nodeName, isReadyCluster) {
    var genericIpValue = RegExp('[\\s\\S]*(([0-9]{1,3}(\.|)){4})|(N/A)[\\s\\S]*', 'i');
    if (isReadyCluster) {
      genericIpValue = RegExp('[\\s\\S]*([0-9]{1,3}(\.|)){4}[\\s\\S]*', 'i');
    }
    return this.remote
      .clickByCssSelector(nodeSelector)
      .then(() => this.modal.waitToOpen())
      .assertElementMatchesRegExp(this.managementIpSelector, genericIpValue,
        '"Management IP" field for "' + nodeName + '" node has default value')
      .assertElementMatchesRegExp(this.publicIpSelector, genericIpValue,
        '"Public IP" field for "' + nodeName + '" node has default value')
      .then(() => this.modal.close());
  }

  checkNoIpValues(nodeSelector, nodeName) {
    return this.remote
      .clickByCssSelector(nodeSelector)
      .then(() => this.modal.waitToOpen())
      .assertElementNotExists(this.managementIpSelector,
        '"Management IP" field for "' + nodeName + '" node not exists')
      .assertElementNotExists(this.publicIpSelector,
        '"Public IP" field for "' + nodeName + '" node not exists')
      .then(() => this.modal.close());
  }

  activateFiltering() {
    var btnFilteringSelector = '.btn-filters';
    var filterPaneSelector = 'div.filters';
    return this.remote
      .assertElementsExist(btnFilteringSelector, '"Filter Nodes" button exists')
      .clickByCssSelector(btnFilteringSelector)
      .assertElementsAppear(filterPaneSelector, 500, '"Filter" pane is appears');
  }

  setFilterByStatus(statusArray) {
    var filterSelector = 'div.filter-by-status ';
    var btnDefaultSelector = '.btn-default';
    var filterPopover = 'div.popover';
    var chain = this.remote;

    chain = chain.assertElementsExist(filterSelector, 'Filter sorting block is observed')
    .assertElementContainsText(filterSelector + btnDefaultSelector, 'Status',
      'Filter by status is default')
    .clickByCssSelector(filterSelector + btnDefaultSelector)
    .assertElementsAppear(filterPopover, 500, '"Status" filter popover is appears');
    for (let i = 0; i < statusArray.length; i++) {
      chain = chain.clickByCssSelector(statusArray[i]);
    }
    chain = chain.assertElementsAppear(filterSelector, 1000, 'Filter by status is appears');
    return chain;
  }

  deactivateFiltering() {
    var btnResetFiltersSelector = '.btn-reset-filters';
    return this.remote
      .assertElementsExist(btnResetFiltersSelector, '"Reset Filters" button exists')
      .clickByCssSelector(btnResetFiltersSelector)
      .assertElementDisappears(btnResetFiltersSelector, 1000, '"Reset Filters" button disappears');
  }

  activateSorting() {
    var btnSortingSelector = '.btn-sorters';
    var sortPaneSelector = 'div.sorters';
    return this.remote
      .assertElementsExist(btnSortingSelector, '"Sort Nodes" button exists')
      .clickByCssSelector(btnSortingSelector)
      .assertElementsAppear(sortPaneSelector, 500, '"Sort" pane appears');
  }

  activateQuickSearch() {
    var btnQuickSearchSelector = '.btn-search';
    return this.remote
      .assertElementsExist(btnQuickSearchSelector, '"Quick Search" button exists')
      .clickByCssSelector(btnQuickSearchSelector)
      .assertElementsAppear(this.txtSearchSelector, 500, 'Textfield for search value appears');
  }

  checkQuickSearch(nodeSelector, totalNodes, nameSelector, searchName, searchValue, notClean) {
    var btnClearSelector = '.btn-clear-search';
    var chain = this.remote;

    chain = chain.assertElementsExist(this.txtSearchSelector, 'Textfield for search value exists')
    .setInputValue(this.txtSearchSelector, searchValue)
    .sleep(500)
    .assertElementsExist(nodeSelector, 1, 'Only one node with correct name "' +
      searchName + '" is observed')
    .assertElementTextEquals(nameSelector, searchName, 'Only one node with correct name "' +
      searchName + '" is observed');
    if (!notClean) {
      chain = chain.assertElementsExist(btnClearSelector, '"Clear Search" button exists')
      .clickByCssSelector(btnClearSelector)
      .assertElementsExist(nodeSelector, totalNodes, 'Default nodes quantity is observed')
      .assertElementPropertyEquals(this.txtSearchSelector, 'value', '',
        'Textfield for search value is cleared');
    }
    return chain;
  }
}

export default EquipmentLib;
