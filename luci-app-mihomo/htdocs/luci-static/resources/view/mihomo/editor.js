'use strict';
'require form';
'require view';
'require uci';
'require fs';
'require tools.mihomo as mihomo';

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('mihomo'),
            mihomo.listProfiles(),
        ]);
    },
    render: function (data) {
        const subscriptions = uci.sections('mihomo', 'subscription');
        const profiles = data[1];

        let m, s, o;

        m = new form.Map('mihomo');

        s = m.section(form.NamedSection, 'editor', 'editor');

        o = s.option(form.ListValue, '_profile', _('Choose Profile'));
        o.optional = true;

        for (const profile of profiles) {
            o.value(mihomo.profilesDir + '/' + profile.name, _('File:') + profile.name);
        };

        for (const subscription of subscriptions) {
            o.value(mihomo.subscriptionsDir + '/' + subscription['.name'] + '.yaml', _('Subscription:') + subscription.name);
        };

        o.value(mihomo.mixinFilePath, _('File for Mixin'));
        o.value(mihomo.runProfilePath, _('Profile for Startup'));
        o.value(mihomo.reservedIPNFT, _('File for Reserved IP'));
        o.value(mihomo.reservedIP6NFT, _('File for Reserved IP6'));

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
        const path = this.m.lookupOption('_profile', 'editor')[0].formvalue('editor');
        const content = this.editor ? this.editor.getValue() : '';
        return { path, content };
    },

    saveContent(path, content) {
        return fs.write(path, content);
    },

    handleSaveApply(ev, mode) {
        const { path, content } = this.getEditorData();

        return this.saveContent(path, content).finally(() => {
            return mode === '0' ? mihomo.reload() : mihomo.restart();
        });
    },

    handleSave(ev) {
        const { path, content } = this.getEditorData();

        return this.saveContent(path, content);
    },

    handleReset: null
});