'use strict';
'require form';
'require view';
'require uci';
'require fs';
'require tools.nikki as nikki'

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('nikki'),
            nikki.listProfiles(),
            nikki.listRuleProviders(),
            nikki.listProxyProviders(),
        ]);
    },
    render: function (data) {
        const subscriptions = uci.sections('nikki', 'subscription');
        const profiles = data[1];
        const ruleProviders = data[2];
        const proxyProviders = data[3];

        let m, s, o;

        m = new form.Map('nikki');
        this.m = m;
        s = m.section(form.NamedSection, 'editor', 'editor', _('Editor'));

        o = s.option(form.ListValue, '_file', _('Choose File'));
        o.optional = true;

        for (const profile of profiles) {
            o.value(nikki.profilesDir + '/' + profile.name, _('File:') + profile.name);
        };

        for (const subscription of subscriptions) {
            o.value(nikki.subscriptionsDir + '/' + subscription['.name'] + '.yaml', _('Subscription:') + subscription.name);
        };

        for (const ruleProvider of ruleProviders) {
            o.value(nikki.ruleProvidersDir + '/' + ruleProvider.name, _('Rule Provider:') + ruleProvider.name);
        };

        for (const proxyProvider of proxyProviders) {
            o.value(nikki.proxyProvidersDir + '/' + proxyProvider.name, _('Proxy Provider:') + proxyProvider.name);
        };

        o.value(nikki.mixinFilePath, _('File for Mixin'));
        o.value(nikki.runProfilePath, _('Profile for Startup'));

        const editorContainer = document.createElement('div');
        editorContainer.id = 'editor';
        editorContainer.style.height = '500px';
        editorContainer.style.width = '100%';
        editorContainer.style.resize = 'both';
        editorContainer.style.overflow = 'auto';
        this.m.render().then(mapEl => {
            mapEl.appendChild(editorContainer);
            this.initAceEditor(editorContainer);
        });

        o.onchange = (event, section_id, value) => {
            return L.resolveDefault(fs.read_direct(value), '').then(content => {
                if (this.editor) {
                    this.editor.setValue(content, -1);
                }
            });
        };

        return this.m.render();
    },

    loadAceModule: function (url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(script);
        });
    },

    initAceEditor: function (container) {
        this.loadAceModule('/luci-static/resources/ace/ace.min.js').then(() => {

            ace.config.set('basePath', '/luci-static/resources/ace');
            ace.config.setModuleUrl('ace/theme/tomorrow_night', '/luci-static/resources/ace/theme-tomorrow_night.min.js');
            ace.config.setModuleUrl('ace/mode/yaml', '/luci-static/resources/ace/mode-yaml.min.js');
            ace.config.setModuleUrl('ace/mode/yaml_worker', '/luci-static/resources/ace/worker-yaml.min.js');

            const editor = ace.edit(container);

            editor.setTheme("ace/theme/tomorrow_night");
            editor.session.setMode("ace/mode/yaml");
            editor.setOptions({
                //enableBasicAutocompletion: true,
                //enableSnippets: true,
                //enableLiveAutocompletion: false,
                fontSize: "15px"
            });
            this.editor = editor;

            const resizeObserver = new ResizeObserver(() => {
                editor.resize(true);
            });
            resizeObserver.observe(container);

        }).catch(error => {
            console.error('Failed to load scripts for Ace Editor:', error);
        });
    },

    getEditorData() {
        const path = this.m.lookupOption('_file', 'editor')[0].formvalue('editor');
        const content = this.editor ? this.editor.getValue() : '';
        return { path, content };
    },

    saveContent(path, content) {
        return fs.write(path, content);
    },

    handleSaveApply(ev, mode) {
        const { path, content } = this.getEditorData();

        return this.saveContent(path, content).finally(() => {
            return mode === '0' ? nikki.reload() : nikki.restart();
        });
    },

    handleSave(ev) {
        const { path, content } = this.getEditorData();

        return this.saveContent(path, content);
    },

    handleReset: null
});