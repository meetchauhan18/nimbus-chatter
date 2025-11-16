import { ModuleRegistry } from '../ModuleRegistry.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('ModuleRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  it('should register and resolve singleton service', () => {
    let callCount = 0;
    registry.registerService('test.service', () => {
      callCount++;
      return { data: 'test' };
    });

    const instance1 = registry.resolve('test.service');
    const instance2 = registry.resolve('test.service');

    assert.strictEqual(instance1, instance2, 'Singleton should return same instance');
    assert.strictEqual(callCount, 1, 'Factory should be called once');
  });

  it('should resolve dependencies in correct order', () => {
    const order = [];

    registry.registerService('service.a', () => {
      order.push('a');
      return { name: 'a' };
    });

    registry.registerService('service.b', (reg) => {
      const a = reg.resolve('service.a');
      order.push('b');
      return { name: 'b', dep: a };
    }, { dependencies: ['service.a'] });

    const b = registry.resolve('service.b');

    assert.deepStrictEqual(order, ['a', 'b']);
    assert.strictEqual(b.dep.name, 'a');
  });

  it('should detect circular dependencies', () => {
    registry.registerService('service.a', (reg) => {
      return { b: reg.resolve('service.b') };
    }, { dependencies: ['service.b'] });

    registry.registerService('service.b', (reg) => {
      return { a: reg.resolve('service.a') };
    }, { dependencies: ['service.a'] });

    assert.throws(() => {
      registry.resolve('service.a');
    }, /Circular dependency/);
  });

  it('should throw error for unregistered service', () => {
    assert.throws(() => {
      registry.resolve('nonexistent');
    }, /not registered/);
  });

  it('should register and initialize module', async () => {
    let registerCalled = false;
    let initCalled = false;

    const module = {
      name: 'test',
      register: (reg) => {
        registerCalled = true;
        reg.registerService('test.value', () => 42);
      },
      init: async (reg) => {
        initCalled = true;
        const value = reg.resolve('test.value');
        assert.strictEqual(value, 42);
      },
    };

    registry.registerModule(module);
    await registry.initModule('test');

    assert.strictEqual(registerCalled, true);
    assert.strictEqual(initCalled, true);
  });
});
