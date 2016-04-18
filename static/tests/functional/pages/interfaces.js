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

import _ from 'intern/dojo/node!lodash';
import assert from 'intern/chai!assert';

function InterfacesPage(remote) {
  this.remote = remote;
}

InterfacesPage.prototype = {
  constructor: InterfacesPage,
  findInterfaceElement: function(ifcName) {
    return this.remote
      .findAllByCssSelector('div.ifc-inner-container')
        .then(
          (ifcElements) => ifcElements.reduce(
            (result, ifcElement) => ifcElement
              .findByCssSelector('.common-ifc-name')
                .then(
                  (ifcDiv) => ifcDiv
                    .getVisibleText()
                      .then(
                        (currentIfcName) => _.trim(currentIfcName) === ifcName ? ifcElement : result
                      )
                ),
            null
          )
        );
  },
  findInterfaceElementInBond: function(bondName, ifcName) {
    return this.remote
      .findAllByCssSelector('.' + bondName + ' .ifc-info-block')
        .then(
          (ifcsElements) => ifcsElements.reduce(
            (result, ifcElement) => ifcElement
              .findByCssSelector('.ifc-name')
                .then(
                  (ifcNameElement) => ifcNameElement
                    .getVisibleText()
                      .then((foundIfcName) => ifcName === foundIfcName ? ifcElement : result)
                ),
            null
          )
        );
  },
  removeInterfaceFromBond: function(bondName, ifcName) {
    return this.remote
      .then(() => this.findInterfaceElementInBond(bondName, ifcName))
      .then(
        (ifcElement) => ifcElement
          .findByCssSelector('.btn-link')
            .then((btnRemove) => btnRemove.click())
      );
  },
  assignNetworkToInterface: function(networkName, ifcName) {
    return this.remote
      .findAllByCssSelector('div.network-block')
        .then(
          (networkElements) => networkElements.reduce(
            (result, networkElement) => networkElement
              .getVisibleText()
                .then((currentNetworkName) => {
                  return currentNetworkName === networkName ? networkElement : result;
                }),
            null
          )
        )
        .then((networkElement) => this.parent.dragFrom(networkElement))
        .then(() => this.findInterfaceElement(ifcName))
        .then((ifcElement) => this.parent.dragTo(ifcElement));
  },
  selectInterface: function(ifcName) {
    return this.remote
      .then(() => this.findInterfaceElement(ifcName))
      .then((ifcElement) => {
        if (!ifcElement) throw new Error('Unable to select interface ' + ifcName);
        return ifcElement
          .findByCssSelector('input[type=checkbox]:not(:checked)')
            .then((ifcCheckbox) => ifcCheckbox.click());
      });
  },
  bondInterfaces: function(ifc1, ifc2) {
    return this.remote
      .then(() => this.selectInterface(ifc1))
      .then(() => this.selectInterface(ifc2))
      .clickByCssSelector('.btn-bond');
  },
  checkBondInterfaces: function(bondName, ifcsNames) {
    return this.remote
      .then(() => this.findInterfaceElement(bondName))
      .then(
        (bondElement) => bondElement
          .findAllByCssSelector('.ifc-info .ifc-name')
            .then((ifcNamesElements) => {
              assert.equal(
                ifcNamesElements.length,
                ifcsNames.length,
                'Unexpected number of interfaces in bond'
              );

              return ifcNamesElements.forEach(
                (ifcNameElement) => ifcNameElement
                    .getVisibleText()
                      .then((name) => {
                        name = _.trim(name);
                        if (!_.contains(ifcsNames, name)) {
                          throw new Error('Unexpected name in bond: ' + name);
                        }
                      })
                );
            })
      );
  }
};

export default InterfacesPage;
