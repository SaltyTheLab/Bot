export class CountingStateManager {
    guildStates = new Map()

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
    initialize(start, guildId) {
        const state = this._getState(guildId);
        state.count = start;
        state.lastUser = null;
    }
}
export const countingStateManager = new CountingStateManager();