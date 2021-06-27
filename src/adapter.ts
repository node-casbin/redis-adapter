import {Helper, Model, Adapter} from 'casbin'
import * as redis from 'redis'

interface IConnectionOptions {
    host: string
    port: number
}

class Line {
    p_type: string = ''
    v0: string = ''
    v1: string = ''
    v2: string = ''
    v3: string = ''
    v4: string = ''
    v5: string = ''
}

// noinspection FallThroughInSwitchStatementJS
export class NodeRedisAdapter implements Adapter {

    private readonly redisInstance
    private policies: Line[]
    private filtered = false

    public isFiltered(): boolean {
        return this.filtered
    }

    private deliveredOptions = {
        retry_strategy(options: any) {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                return new Error('The server refused the connection.')
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                return new Error('Retry time exhausted')
            }
            if (options.attempt > 10) {
                return undefined
            }

            // reconnect after
            return Math.min(options.attempt * 100, 300)
        }
    }


    //Helper Methods

    savePolicyLine(ptype: any, rule: any) {
        const line = new Line()
        line.p_type = ptype
        // if (rule.length > 0) {
        //     line.v0 = rule[0]
        // }
        // if (rule.length > 1) {
        //     line.v1 = rule[1]
        // }
        // if (rule.length > 2) {
        //     line.v2 = rule[2]
        // }
        // if (rule.length > 3) {
        //     line.v3 = rule[3]
        // }
        // if (rule.length > 4) {
        //     line.v4 = rule[4]
        // }
        // if (rule.length > 5) {
        //     line.v5 = rule[5]
        // }
        switch (rule.length) {
            case 6:
                line.v5 = rule[5]
            case 5:
                line.v4 = rule[4]
            case 4:
                line.v3 = rule[3]
            case 3:
                line.v2 = rule[2]
            case 2:
                line.v1 = rule[1]
            case 1:
                line.v0 = rule[0]
                break;
            default:
                throw new Error('Rule should not be empty or have more than 6 arguments.');
        }
        return line
    }

    loadPolicyLine(line: any, model: any) {
        //console.log("Load policies line called")
        let lineText = line.p_type
        if (line.v0) {
            lineText += ", " + line.v0
        }
        if (line.v1) {
            lineText += ", " + line.v1
        }
        if (line.v2) {
            lineText += ", " + line.v2
        }
        if (line.v3) {
            lineText += ", " + line.v3
        }
        if (line.v4) {
            lineText += ", " + line.v4
        }
        if (line.v5) {
            lineText += ", " + line.v5
        }
        Helper.loadPolicyLine(lineText, model)
    }

    storePolicies(policies: Line[]) : Promise<void>{
        return new Promise((resolve, reject) => {
            //console.log({ r: this.redisInstance })
            this.redisInstance.del('policies')
            this.redisInstance.set('policies', JSON.stringify(policies), (err: any, reply: any) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(reply)
                }
            })
        })
    }


    constructor(options: IConnectionOptions) {
        this.redisInstance = redis.createClient(
            {
                ...options,
                ...this.deliveredOptions
            }
        )
    }


    static async newAdapter(options: IConnectionOptions) {
        const adapter = new NodeRedisAdapter(options)
        await new Promise(resolve => adapter.redisInstance.on('connect', resolve))
        return adapter
    }

    // Adapter Methods

    public async loadPolicy(model: Model): Promise<void> {
        return await new Promise((resolve, reject) => {
            this.redisInstance.get("policies", (err, policies) => {
                if (!err) {
                    const parsedPolicies = JSON.parse(policies!)
                    this.policies = parsedPolicies // for adding and removing policies methods
                    parsedPolicies.forEach((policy: any) => {
                        this.loadPolicyLine(policy, model)
                    })
                    resolve()
                } else {
                    reject(err)
                }
            })
        })

    }

    // public async loadFilteredPolicy(model: Model, filter: any): Promise<void> {
    //     let key = filter['haskey']
    //     return await new Promise((resolve, reject) => {
    //         this.redisInstance.hgetall(key, (err, policies) => {
    //             if (!err) {
    //                 const AdapterRef = this;
    //                 //console.log("Policies : ", policies)
    //                 const parsedpolicies = JSON.parse(policies[key])
    //                 this.policies = policies
    //                 //console.log(policies)
    //                 parsedpolicies.forEach((policy: any) => {
    //                     AdapterRef.loadPolicyLine(policy, model)
    //                 })
    //                 //console.log("Filtered Policies are loaded")
    //                 this.filtered = true
    //                 resolve()
    //             } else {
    //                 reject(err)
    //             }
    //         })
    //     })
    // }

    public async savePolicy(model: Model): Promise<boolean> {

        const policyRuleAST = model.model.get("p")!
        const groupingPolicyAST = model.model.get("g")!
        let policies: Line[] = []

        //console.log(policyRuleAST)

        for (const astMap of [policyRuleAST, groupingPolicyAST]) {
            for (const [p_type, ast] of astMap) {
                for (const rule of ast.policy) {
                    const line = this.savePolicyLine(p_type, rule)
                    policies.push(line)
                }
            }
        }


        return new Promise((resolve, reject) => {
            this.redisInstance.del('policies')
            this.redisInstance.set('policies', JSON.stringify(policies), (err: any) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(true)
                }
            })
        })
    }

    async addPolicy(sec: string, p_type: string, rule: any) {
        const line = this.savePolicyLine(p_type, rule)
        this.policies.push(line)
        await this.storePolicies(this.policies)
        // resave the policies
    }

    async removePolicy(sec: string, p_type: string, rule: string[]): Promise<void> {
        const filteredPolicies = this.policies.filter((policy) => {
            let flag = true;
            flag &&= p_type == policy.p_type;
            if (rule.length > 0) {
                flag &&= rule[0] == policy.v0;
            }
            if (rule.length > 1) {
                flag &&= rule[1] == policy.v1;
            }
            if (rule.length > 2) {
                flag &&= rule[2] == policy.v2;
            }
            if (rule.length > 3) {
                flag &&= rule[3] == policy.v3;
            }
            if (rule.length > 4) {
                flag &&= rule[4] == policy.v4;
            }
            if (rule.length > 5) {
                flag &&= rule[5] == policy.v5;
            }
            return !flag
        })
        this.policies = filteredPolicies;
        return await this.storePolicies(filteredPolicies);
    }

    public async removeFilteredPolicy(sec: string, p_type: string, fieldIndex: number, ...fieldValues: string[]) {
        throw new Error("Method not implemented")
    }
}
