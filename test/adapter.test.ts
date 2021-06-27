import {Enforcer, Util} from 'casbin';
import {NodeRedisAdapter} from '../src/adapter';


async function testGetPolicy(e: Enforcer, res: string[][]) {
    const myRes = await e.getPolicy();

    expect(Util.array2DEquals(res, myRes)).toBe(true);
}


test('test Adapter', async () => {
    const redisAdapter = new NodeRedisAdapter({host: "127.0.0.1", port: 6379})
    let e = new Enforcer();

    await e.initWithFile(
        'examples/rbac_model.conf',
        'examples/rbac_policy.csv',
    );

    // This is a trick to save the current policy to the DB.
    // We can't call e.savePolicy() because the adapter in the enforcer is still the file adapter.
    // The current policy means the policy in the Node-Casbin enforcer (aka in memory).
    await redisAdapter.savePolicy(e.getModel());

    e.clearPolicy();

    await testGetPolicy(e, []);

    // Load the policy from DB.
    await redisAdapter.loadPolicy(e.getModel());
    await testGetPolicy(e, [
        ['alice', 'data1', 'read'],
        ['bob', 'data2', 'write'],
        ['data2_admin', 'data2', 'read'],
        ['data2_admin', 'data2', 'write'],
    ]);

    e = new Enforcer();
    await e.initWithAdapter('examples/rbac_model.conf', redisAdapter);
    await testGetPolicy(e, [
        ['alice', 'data1', 'read'],
        ['bob', 'data2', 'write'],
        ['data2_admin', 'data2', 'read'],
        ['data2_admin', 'data2', 'write'],
    ]);

    // await redisAdapter.loadFilteredPolicy(e.getModel(), {ptype: 'p', v0: 'alice'});
    // await testGetFilteredPolicy(e, ['alice', 'data1', 'read']);

    // Add policy to DB
    await redisAdapter.addPolicy('', 'p', ['role', 'res', 'action']);
    e = new Enforcer();
    await e.initWithAdapter('examples/rbac_model.conf', redisAdapter);
    await testGetPolicy(e, [
        ['alice', 'data1', 'read'],
        ['bob', 'data2', 'write'],
        ['data2_admin', 'data2', 'read'],
        ['data2_admin', 'data2', 'write'],
        ['role', 'res', 'action'],
    ]);


    // Remove policy from DB
    await redisAdapter.removePolicy('', 'p', ['role', 'res', 'action']);
    e = new Enforcer();
    await e.initWithAdapter('examples/rbac_model.conf', redisAdapter);
    await testGetPolicy(e, [
        ['alice', 'data1', 'read'],
        ['bob', 'data2', 'write'],
        ['data2_admin', 'data2', 'read'],
        ['data2_admin', 'data2', 'write'],
    ]);
}, 30 * 1000)
