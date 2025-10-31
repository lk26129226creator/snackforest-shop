(function () {
    const output = document.getElementById('test-output');
    const summary = document.getElementById('test-summary');
    const tests = [];
    let passed = 0;
    let failed = 0;

    function updateSummary() {
        const total = passed + failed;
        if (total === 0) {
            summary.textContent = '尚未有測試結果。';
            return;
        }
        summary.textContent = `共 ${total} 項測試，通過 ${passed} 項，失敗 ${failed} 項。`;
        summary.style.background = failed ? '#f8d7da' : '#d1e7dd';
        summary.style.color = failed ? '#842029' : '#0f5132';
    }

    function renderResult(name, status, info) {
        const card = document.createElement('div');
        card.className = `result ${status}`;
        const title = document.createElement('h2');
        title.textContent = name;
        card.appendChild(title);
        const message = document.createElement('div');
        message.textContent = info || (status === 'pass' ? '通過' : '失敗');
        card.appendChild(message);
        output.appendChild(card);
    }

    function expect(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    function expectEqual(actual, expected, message) {
        if (!Object.is(actual, expected)) {
            const detail = message || `Expected ${expected}, received ${actual}`;
            throw new Error(detail);
        }
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    window.defineTest = function (name, fn) {
        tests.push({ name, fn });
    };

    async function runAllTests() {
        output.innerHTML = '';
        passed = 0;
        failed = 0;
        for (const { name, fn } of tests) {
            try {
                const result = fn(expect, expectEqual, wait);
                if (result && typeof result.then === 'function') {
                    await result;
                }
                passed += 1;
                renderResult(name, 'pass');
            } catch (err) {
                failed += 1;
                renderResult(name, 'fail', err && err.message ? err.message : String(err));
                console.error('[Test Failure]', name, err);
            }
        }
        updateSummary();
    }

    window.runAllTests = runAllTests;

    window.alert = window.alert || function () {};
    window.confirm = window.confirm || function () { return true; };
})();

(function () {
    const Admin = window.SFAdmin;
    const { state } = Admin;

    function resetState() {
        state.allProducts = [];
        state.allCategories = [];
        state.allOrders = [];
        state.cacheMeta = state.cacheMeta || { products: 0, categories: 0, orders: 0 };
        state.cacheMeta.products = 0;
        state.cacheMeta.categories = 0;
        state.cacheMeta.orders = 0;
        state.activeSection = 'dashboard-section';
    }

    function ensureStubs() {
        Admin.carousel = Admin.carousel || {};
        if (typeof Admin.carousel.loadSlides !== 'function') {
            Admin.carousel.loadSlides = async () => [];
        }
        if (typeof Admin.carousel.renderEditor !== 'function') {
            Admin.carousel.renderEditor = () => {};
        }
        Admin.site = Admin.site || {};
        if (typeof Admin.site.ensureSection !== 'function') {
            Admin.site.ensureSection = async () => {};
        }
        Admin.dashboard = Admin.dashboard || {};
        if (typeof Admin.dashboard.render !== 'function') {
            Admin.dashboard.render = () => {};
        }
        if (typeof Admin.dashboard.bindActions !== 'function') {
            Admin.dashboard.bindActions = () => {};
        }
    }

    function resetDomSelections() {
        document.querySelectorAll('.admin-section').forEach((section) => {
            section.classList.remove('active');
        });
        document.querySelectorAll('.navbar .nav-link').forEach((link) => {
            link.classList.remove('active');
        });
        document.querySelectorAll('.admin-sidebar-link').forEach((button) => {
            button.classList.remove('active');
        });
    }

    defineTest('utils.deepClone returns independent copy', () => {
        const source = { a: 1, nested: { value: 3 } };
        const copy = Admin.utils.deepClone(source);
        expect(copy !== source, 'Clone should be a new object');
        expectEqual(copy.nested.value, 3, 'Nested value matches');
        copy.nested.value = 42;
        expectEqual(source.nested.value, 3, 'Original remains unchanged');
    });

    defineTest('utils.withRetry resolves after retries', async () => {
        let attempts = 0;
        const result = await Admin.utils.withRetry(async () => {
            attempts += 1;
            if (attempts < 3) throw new Error('wait');
            return 'ok';
        }, { retries: 3, delay: 5 });
        expectEqual(result, 'ok', 'Result should resolve');
        expectEqual(attempts, 3, 'Should retry until success');
    });

    defineTest('utils.withRetry throws after max retries', async () => {
        let attempts = 0;
        let errorCaught = false;
        try {
            await Admin.utils.withRetry(async () => {
                attempts += 1;
                throw new Error('nope');
            }, { retries: 1, delay: 5 });
        } catch (err) {
            errorCaught = true;
            expect(err.message.includes('nope'), 'Error should propagate');
        }
        expect(errorCaught, 'Should throw after retries exhausted');
        expectEqual(attempts, 2, 'Attempts equals retries + 1');
    });

    defineTest('utils.debounce waits before running', async () => {
        let calls = 0;
        const debounced = Admin.utils.debounce(() => { calls += 1; }, 40);
        debounced();
        debounced();
        await wait(25);
        debounced();
        await wait(60);
        expectEqual(calls, 1, 'Debounced function runs once');
    });

    defineTest('data.loadProducts caches results', async () => {
        resetState();
        ensureStubs();
        let fetchCalls = 0;
        const originalFetch = Admin.utils.fetchJson;
        Admin.utils.fetchJson = async () => {
            fetchCalls += 1;
            return [{ id: 1, name: 'A' }];
        };
        try {
            await Admin.data.loadProducts({ force: true });
            expectEqual(fetchCalls, 1, 'Forced load hits fetch');
            await Admin.data.loadProducts();
            expectEqual(fetchCalls, 1, 'Cached load skips fetch');
        } finally {
            Admin.utils.fetchJson = originalFetch;
        }
    });

    defineTest('data.loadProducts emits products:updated', async () => {
        resetState();
        ensureStubs();
        const originalFetch = Admin.utils.fetchJson;
        let eventDetail;
        const off = Admin.core.on('products:updated', (event) => {
            eventDetail = event.detail;
        });
        Admin.utils.fetchJson = async () => [{ id: 7, name: 'Snack' }];
        try {
            await Admin.data.loadProducts({ force: true });
            expect(eventDetail && Array.isArray(eventDetail.data), 'Event carries data array');
            expectEqual(eventDetail.data[0].id, 7, 'Event payload matches dataset');
        } finally {
            off();
            Admin.utils.fetchJson = originalFetch;
        }
    });

    defineTest('navigation.showSection toggles active classes', () => {
        resetState();
        ensureStubs();
        resetDomSelections();
        Admin.navigation.showSection('products-section');
        const productsSection = document.getElementById('products-section');
        const dashboardSection = document.getElementById('dashboard-section');
        expect(productsSection.classList.contains('active'), 'Products section active');
        expect(!dashboardSection.classList.contains('active'), 'Dashboard section inactive');
        const navLink = document.getElementById('nav-products');
        expect(navLink.classList.contains('active'), 'Products nav link active');
    });

    defineTest('navigation.switchToSection dashboard triggers ensures', async () => {
        resetState();
        ensureStubs();
        resetDomSelections();
        let renderCalled = 0;
        let ensureProducts = 0;
        let ensureCategories = 0;
        let ensureOrders = 0;
        Admin.dashboard.render = () => { renderCalled += 1; };
        Admin.data.ensureProducts = () => { ensureProducts += 1; return Promise.resolve(); };
        Admin.data.ensureCategories = () => { ensureCategories += 1; return Promise.resolve(); };
        Admin.data.ensureOrders = () => { ensureOrders += 1; return Promise.resolve(); };
        await Admin.navigation.switchToSection('dashboard-section', { force: true });
        expectEqual(renderCalled, 1, 'Dashboard render invoked');
        expectEqual(ensureProducts, 1, 'Products ensure called');
        expectEqual(ensureCategories, 1, 'Categories ensure called');
        expectEqual(ensureOrders, 1, 'Orders ensure called');
    });

    defineTest('navigation.switchToSection carousel loads slides', async () => {
        resetState();
        ensureStubs();
        resetDomSelections();
        let loadCalled = 0;
        let renderSlides;
        Admin.carousel.loadSlides = async () => {
            loadCalled += 1;
            return ['slide-a'];
        };
        Admin.carousel.renderEditor = (slides) => {
            renderSlides = slides;
        };
        await Admin.navigation.switchToSection('carousel-section', { force: true });
        expectEqual(loadCalled, 1, 'Carousel loader invoked');
        expect(Array.isArray(renderSlides), 'Slides passed to renderer');
        expectEqual(renderSlides[0], 'slide-a', 'Renderer receives slide data');
    });

    defineTest('navigation.switchToSection site ensures config', async () => {
        resetState();
        ensureStubs();
        resetDomSelections();
        let ensureCalled = 0;
        Admin.site.ensureSection = async () => {
            ensureCalled += 1;
        };
        await Admin.navigation.switchToSection('site-section', { force: true });
        expectEqual(ensureCalled, 1, 'Site ensureSection invoked');
    });

    window.addEventListener('load', () => {
        resetState();
        ensureStubs();
        resetDomSelections();
        Admin.navigation.showSection('dashboard-section');
        runAllTests();
    });
})();
