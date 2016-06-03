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

import _ from 'underscore';
import React from 'react';
import {loadPropsMixin} from 'component_mixins';

var NodesTab = React.createClass({
  mixins: [
    loadPropsMixin
  ],
  statics: {
    waitForParentData: true,
    breadcrumbTitle: 'cluster_page.tabs.nodes'
  },
  render() {
    var props = _.pick(this.props, 'cluster', 'selectedNodeIds', 'selectNodes');
    return React.cloneElement(React.Children.only(this.props.children), props);
  }
});

export default NodesTab;
