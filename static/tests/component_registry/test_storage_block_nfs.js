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
  'use strict';

  registerSuite(function() {
    var common, modal;

    return {
      name: 'Wizard Page',
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
      'Test create plugin with block:nfs, incompatible with object:sheepdog, object:cat': function() {
      // https://mirantis.testrail.com/index.php?/cases/view/842460

        return this.remote
          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that cat and sheepdog are disabled when nfs is enabled
          .clickByCssSelector('input[value=storage\\:block\\:nfs]')
          .assertElementDisabled('input[value=storage\\:object\\:cat]',
                                 'Cat checkbox is disabled')
          .assertElementDisabled('input[value=storage\\:object\\:sheepdog]',
                                 'Sheepdog checkbox is disabled')
          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="cat"]'+
                               '[data-original-title="Not compatible with nfs"]')
          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="sheepdog"]'+
                               '[data-original-title="Not compatible with nfs"]')

          // Check that nfs is disabled when cat and sheepdog are enabled
          .clickByCssSelector('input[value=storage\\:block\\:nfs]')
          .clickByCssSelector('input[value=storage\\:object\\:cat')
          .assertElementDisabled('input[value=storage\\:block\\:nfs]',
                                 'Nfs checkbox is enabled with cat')
          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="nfs"]'+
                               '[data-original-title="not compatible with cat"]')
          .clickByCssSelector('input[value=storage\\:object\\:sheepdog')
          .assertElementDisabled('input[value=storage\\:block\\:nfs]',
                                 'Nfs checkbox is enabled with sheepdog')
          .clickByCssSelector('input[value=storage\\:object\\:cat')
          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="nfs"]'+
                               '[data-original-title="not compatible with sheepdog"]')

          .clickByCssSelector('button.close');
      }
    };
  });
});
