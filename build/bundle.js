
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.48.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.48.0 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let body;
    	let main;
    	let h1;
    	let t1;
    	let userText0;
    	let t2;
    	let input0;
    	let t3;
    	let userText1;
    	let t4;
    	let input1;
    	let t5;
    	let userText2;
    	let t6;
    	let input2;
    	let t7;
    	let input3;
    	let t8;
    	let userText3;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			body = element("body");
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "MDH 灵敏度转换工具";
    			t1 = space();
    			userText0 = element("userText");
    			t2 = text("MDH x%: ");
    			input0 = element("input");
    			t3 = space();
    			userText1 = element("userText");
    			t4 = text("游戏1实际HFOV: ");
    			input1 = element("input");
    			t5 = space();
    			userText2 = element("userText");
    			t6 = text("游戏2灵敏度: ");
    			input2 = element("input");
    			t7 = text(" \n游戏2实际HFOV: ");
    			input3 = element("input");
    			t8 = space();
    			userText3 = element("userText");
    			t9 = text("游戏2 MDH ");
    			t10 = text(/*mdh*/ ctx[0]);
    			t11 = text("% 灵敏度为 ");
    			t12 = text(/*res*/ ctx[4]);
    			attr_dev(h1, "class", "svelte-8iof33");
    			add_location(h1, file, 13, 1, 326);
    			attr_dev(main, "class", "svelte-8iof33");
    			add_location(main, file, 12, 0, 318);
    			attr_dev(input0, "type", "number");
    			add_location(input0, file, 17, 8, 377);
    			attr_dev(userText0, "class", "svelte-8iof33");
    			add_location(userText0, file, 16, 0, 358);
    			attr_dev(input1, "type", "number");
    			add_location(input1, file, 20, 11, 452);
    			attr_dev(userText1, "class", "svelte-8iof33");
    			add_location(userText1, file, 19, 0, 430);
    			attr_dev(input2, "type", "number");
    			add_location(input2, file, 24, 8, 528);
    			attr_dev(input3, "type", "number");
    			add_location(input3, file, 25, 11, 583);
    			attr_dev(userText2, "class", "svelte-8iof33");
    			add_location(userText2, file, 23, 0, 509);
    			attr_dev(userText3, "class", "svelte-8iof33");
    			add_location(userText3, file, 28, 0, 640);
    			add_location(body, file, 11, 0, 311);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, body, anchor);
    			append_dev(body, main);
    			append_dev(main, h1);
    			append_dev(body, t1);
    			append_dev(body, userText0);
    			append_dev(userText0, t2);
    			append_dev(userText0, input0);
    			set_input_value(input0, /*mdh*/ ctx[0]);
    			append_dev(body, t3);
    			append_dev(body, userText1);
    			append_dev(userText1, t4);
    			append_dev(userText1, input1);
    			set_input_value(input1, /*hfov1*/ ctx[1]);
    			append_dev(body, t5);
    			append_dev(body, userText2);
    			append_dev(userText2, t6);
    			append_dev(userText2, input2);
    			set_input_value(input2, /*sens2*/ ctx[2]);
    			append_dev(userText2, t7);
    			append_dev(userText2, input3);
    			set_input_value(input3, /*hfov2*/ ctx[3]);
    			append_dev(body, t8);
    			append_dev(body, userText3);
    			append_dev(userText3, t9);
    			append_dev(userText3, t10);
    			append_dev(userText3, t11);
    			append_dev(userText3, t12);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[9]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[10]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*mdh*/ 1 && to_number(input0.value) !== /*mdh*/ ctx[0]) {
    				set_input_value(input0, /*mdh*/ ctx[0]);
    			}

    			if (dirty & /*hfov1*/ 2 && to_number(input1.value) !== /*hfov1*/ ctx[1]) {
    				set_input_value(input1, /*hfov1*/ ctx[1]);
    			}

    			if (dirty & /*sens2*/ 4 && to_number(input2.value) !== /*sens2*/ ctx[2]) {
    				set_input_value(input2, /*sens2*/ ctx[2]);
    			}

    			if (dirty & /*hfov2*/ 8 && to_number(input3.value) !== /*hfov2*/ ctx[3]) {
    				set_input_value(input3, /*hfov2*/ ctx[3]);
    			}

    			if (dirty & /*mdh*/ 1) set_data_dev(t10, /*mdh*/ ctx[0]);
    			if (dirty & /*res*/ 16) set_data_dev(t12, /*res*/ ctx[4]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let actualMDH;
    	let angle1;
    	let angle2;
    	let res;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let mdh = 100;
    	let hfov1 = 45;
    	let sens2 = 1;
    	let hfov2 = 90;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		mdh = to_number(this.value);
    		$$invalidate(0, mdh);
    	}

    	function input1_input_handler() {
    		hfov1 = to_number(this.value);
    		$$invalidate(1, hfov1);
    	}

    	function input2_input_handler() {
    		sens2 = to_number(this.value);
    		$$invalidate(2, sens2);
    	}

    	function input3_input_handler() {
    		hfov2 = to_number(this.value);
    		$$invalidate(3, hfov2);
    	}

    	$$self.$capture_state = () => ({
    		mdh,
    		hfov1,
    		sens2,
    		hfov2,
    		angle1,
    		angle2,
    		res,
    		actualMDH
    	});

    	$$self.$inject_state = $$props => {
    		if ('mdh' in $$props) $$invalidate(0, mdh = $$props.mdh);
    		if ('hfov1' in $$props) $$invalidate(1, hfov1 = $$props.hfov1);
    		if ('sens2' in $$props) $$invalidate(2, sens2 = $$props.sens2);
    		if ('hfov2' in $$props) $$invalidate(3, hfov2 = $$props.hfov2);
    		if ('angle1' in $$props) $$invalidate(5, angle1 = $$props.angle1);
    		if ('angle2' in $$props) $$invalidate(6, angle2 = $$props.angle2);
    		if ('res' in $$props) $$invalidate(4, res = $$props.res);
    		if ('actualMDH' in $$props) $$invalidate(7, actualMDH = $$props.actualMDH);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*mdh*/ 1) {
    			$$invalidate(7, actualMDH = mdh == 0 ? 0.0000001 : mdh / 100);
    		}

    		if ($$self.$$.dirty & /*actualMDH, hfov1*/ 130) {
    			$$invalidate(5, angle1 = Math.atan(actualMDH * Math.tan(hfov1 / 360 * Math.PI)));
    		}

    		if ($$self.$$.dirty & /*actualMDH, hfov2*/ 136) {
    			$$invalidate(6, angle2 = Math.atan(actualMDH * Math.tan(hfov2 / 360 * Math.PI)));
    		}

    		if ($$self.$$.dirty & /*sens2, angle2, angle1*/ 100) {
    			$$invalidate(4, res = sens2 * (angle2 / angle1));
    		}
    	};

    	return [
    		mdh,
    		hfov1,
    		sens2,
    		hfov2,
    		res,
    		angle1,
    		angle2,
    		actualMDH,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
