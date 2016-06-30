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
      'Test create plugin with block:zfs, incompatible with image:nfs': function() {
      // https://mirantis.testrail.com/index.php?/cases/view/842458

        return this.remote
          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage

          // Check that Ceph image storage is inactive when swift image storage is active and vice versa
          .clickByCssSelector('input[value=storage\\:image\\:swift]')
          .assertElementPropertyEquals('input[value=storage\\:image\\:ceph]',
                                       'checked', false, 'Ceph is enabled with swift')
          .clickByCssSelector('input[value=storage\\:image\\:ceph]')
          .assertElementPropertyEquals('input[value=storage\\:image\\:swift]',
                                       'checked', false, 'Swift is enabled with ceph')

          // Close wizard
          .clickByCssSelector('button.close');
      }
    };
  });
});
