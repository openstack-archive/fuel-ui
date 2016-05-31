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

/*
 *  Taken from https://github.com/clayallsopp/react.backbone
 *  Modified to use ES2015 features and Lodash 4.x methods.
 *
 *  The MIT License (MIT)
 *
 *  Copyright (c) 2013 Turboprop Inc
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of
 *  this software and associated documentation files (the "Software"), to deal in
 *  the Software without restriction, including without limitation the rights to
 *  use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 *  the Software, and to permit persons to whom the Software is furnished to do so,
 *  subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 *  FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 *  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 *  IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 *  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**/

import _ from 'underscore';
import Backbone from 'backbone';

var subscribe = function(component, modelOrCollection, customChangeOptions) {
  if (!modelOrCollection) return;

  var updateScheduler = modelOrCollection instanceof Backbone.Collection ?
    (func) => _.debounce(func, 0, {leading: true, trailing: true}) : _.identity;
  var triggerUpdate = updateScheduler(() => {
    if (component.isMounted()) {
      (component.onModelChange || component.forceUpdate).call(component);
    }
  });

  var changeOptions = customChangeOptions ||
    component.changeOptions ||
    (modelOrCollection instanceof Backbone.Collection ? 'update reset sort' : 'change');
  modelOrCollection.on(changeOptions, triggerUpdate, component);
};

var unsubscribe = (component, modelOrCollection) => {
  if (!modelOrCollection) return;
  modelOrCollection.off(null, null, component);
};

var backboneMixin = (options, customChangeOptions) => {
  var modelOrCollection;
  if (_.isPlainObject(options)) {
    customChangeOptions = options.renderOn;
    modelOrCollection = options.modelOrCollection;
  } else {
    modelOrCollection = (props) => props[options];
  }

  return {
    componentDidMount() {
      subscribe(this, modelOrCollection(this.props), customChangeOptions);
    },
    componentWillReceiveProps(nextProps) {
      if (modelOrCollection(this.props) === modelOrCollection(nextProps)) return;

      unsubscribe(this, modelOrCollection(this.props));
      subscribe(this, modelOrCollection(nextProps), customChangeOptions);

      if (_.isFunction(this.componentWillChangeModel)) this.componentWillChangeModel();
    },
    componentDidUpdate(prevProps) {
      if (modelOrCollection(this.props) === modelOrCollection(prevProps)) return;
      if (_.isFunction(this.componentDidChangeModel)) this.componentDidChangeModel();
    },
    componentWillUnmount() {
      unsubscribe(this, modelOrCollection(this.props));
    }
  };
};

export default backboneMixin;
