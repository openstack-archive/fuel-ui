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

define([
  'intern!object',
  'intern/chai!assert',
  'tests/functional/helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, Common, Modal) {
  registerSuite(function() {
    var common, modal;

    return {
      name: 'C842469',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
          .then(function() {
            return common.getIn();
          });
      },
      beforeEach: function() {
        var clusterName = common.pickRandomName('Temp');
        return this.remote
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', clusterName);
      },
      'Test description of components in wizard with qemu': function() {
      // https://mirantis.testrail.com/index.php?/cases/view/842469 (steps 1-3)

//        return this.remote
//          .pressKeys('\uE007')  // go to Compute
//          .clickByCssSelector('input[value=hypervisor\\:vmware]')  // Enable vcenter
//          .pressKeys('\uE007')  // Networking
//
//          // Select Neutron with NSXv plugin and check that it has green light
//          .clickByCssSelector('input[value=network\\:neutron\\:core\\:nsx]')
//          .assertElementExists('i.tooltip-icon.glyphicon-ok-sign[data-reactid*="nsx"]' +
//                               '[data-original-title=' +
//                               '"The component was tested with all the selected components"]')
//
//          // Close wizard
//          .clickByCssSelector('button.close');
      }
    };
  });
});
