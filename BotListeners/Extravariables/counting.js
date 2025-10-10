export class CountingStateManager {
    guildStates = new Map()
    keys = {};

    _getState(guildId) {
        if (!this.guildStates.has(guildId)) {
            this.guildStates.set(guildId, { count: 0, lastUser: null });
        }
        return this.guildStates.get(guildId);
    }

    getCount(guildId) {
        return this._getState(guildId).count;
    }

    getLastUser(guildId) {
        return this._getState(guildId).lastUser;
    }

    reset(guildId) {
        const state = this._getState(guildId);
        state.count = 0;
        state.lastUser = null;
    }

    increaseCount(user, guildId) {
        const state = this._getState(guildId)
        state.count += 1;
        state.lastUser = user
    }
    getkeys(guildId) {
        return this.keys[guildId] || [];

    }
    initialize(start, guildId) {
        const state = this._getState(guildId);
        state.count = start;
        state.lastUser = null;
    }

    addkey(user, guildid) {
        if (!this.keys[guildid])
            this.keys[guildid] = []
        this.keys[guildid].push(user);
    }

    removekey(guildid) {
        if (this.keys[guildid] && this.keys[guildid].length > 0) {
            this.keys[guildid].pop()
        }
    }

}
export const countingStateManager = new CountingStateManager();