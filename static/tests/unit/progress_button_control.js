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

import React from 'react';
import ReactTestUtils from 'react-addons-test-utils';
import {ProgressButton} from 'views/controls';

var node, button, assertSpinning, assertNotSpinning;

// In order to be able to emulate component' props change from the view side
// it should be rendered in container which state changing would affect component' props
var renderInContainer = (component, componentProps = {}) => {
  var PropChangeContainer = React.createClass({
    getInitialState() {
      return componentProps;
    },
    render() {
      return React.createElement(component, this.state);
    }
  });
  var container = ReactTestUtils.renderIntoDocument(<PropChangeContainer />);
  var instance = ReactTestUtils.findRenderedComponentWithType(container, component);
  return [container, instance];
};

suite('Progress Button', () => {
  suiteSetup(() => {
    var isSpinning = (button) => {
      return ReactTestUtils.scryRenderedDOMComponentsWithClass(button, 'btn-progress').length === 1;
    };
    assertSpinning = (button, message) => assert.isTrue(isSpinning(button), message);
    assertNotSpinning = (button, message) => assert.isFalse(isSpinning(button), message);
  });

  setup(() => {
    [node, button] = renderInContainer(
      ProgressButton, {
        progress: false
      });
  });

  test('Test reaction to progress property changes', () => {
    assertNotSpinning(button, 'Not spinning by default');
    node.setState({progress: true});
    assertSpinning(button, 'Spinning when progress is true');
  });
});
