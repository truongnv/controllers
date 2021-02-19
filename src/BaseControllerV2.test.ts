import type { Draft } from 'immer';
import * as sinon from 'sinon';

import { BaseController, getAnonymizedState, getPersistentState } from './BaseControllerV2';

type MockControllerState = {
  count: number;
};

const mockControllerSchema = {
  count: {
    persist: true,
    anonymous: true,
  },
};

class MockController extends BaseController<MockControllerState> {
  update(callback: (state: Draft<MockControllerState>) => void | MockControllerState) {
    super.update(callback);
  }

  destroy() {
    super.destroy();
  }
}

describe('BaseController', () => {
  it('should set initial state', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);

    expect(controller.state).toEqual({ count: 0 });
  });

  it('should set initial schema', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);

    expect(controller.schema).toEqual(mockControllerSchema);
  });

  it('should not allow mutating state directly', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);

    expect(() => {
      controller.state = { count: 1 };
    }).toThrow();
  });

  it('should allow updating state by modifying draft', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);

    controller.update((draft) => {
      draft.count += 1;
    });

    expect(controller.state).toEqual({ count: 1 });
  });

  it('should allow updating state by return a value', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);

    controller.update(() => {
      return { count: 1 };
    });

    expect(controller.state).toEqual({ count: 1 });
  });

  it('should throw an error if update callback modifies draft and returns value', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);

    expect(() => {
      controller.update((draft) => {
        draft.count += 1;
        return { count: 10 };
      });
    }).toThrow();
  });

  it('should inform subscribers of state changes', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);
    const listener1 = sinon.stub();
    const listener2 = sinon.stub();

    controller.subscribe(listener1);
    controller.subscribe(listener2);
    controller.update(() => {
      return { count: 1 };
    });

    expect(listener1.callCount).toEqual(1);
    expect(listener1.firstCall.args).toEqual([{ count: 1 }, [{ op: 'replace', path: [], value: { count: 1 } }]]);
    expect(listener2.callCount).toEqual(1);
    expect(listener2.firstCall.args).toEqual([{ count: 1 }, [{ op: 'replace', path: [], value: { count: 1 } }]]);
  });

  it('should inform a subscriber of each state change once even after multiple subscriptions', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);
    const listener1 = sinon.stub();

    controller.subscribe(listener1);
    controller.subscribe(listener1);
    controller.update(() => {
      return { count: 1 };
    });

    expect(listener1.callCount).toEqual(1);
    expect(listener1.firstCall.args).toEqual([{ count: 1 }, [{ op: 'replace', path: [], value: { count: 1 } }]]);
  });

  it('should no longer inform a subscriber about state changes after unsubscribing', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);
    const listener1 = sinon.stub();

    controller.subscribe(listener1);
    controller.unsubscribe(listener1);
    controller.update(() => {
      return { count: 1 };
    });

    expect(listener1.callCount).toEqual(0);
  });

  it('should no longer inform a subscriber about state changes after unsubscribing once, even if they subscribed many times', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);
    const listener1 = sinon.stub();

    controller.subscribe(listener1);
    controller.subscribe(listener1);
    controller.unsubscribe(listener1);
    controller.update(() => {
      return { count: 1 };
    });

    expect(listener1.callCount).toEqual(0);
  });

  it('should allow unsubscribing listeners who were never subscribed', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);
    const listener1 = sinon.stub();

    expect(() => {
      controller.unsubscribe(listener1);
    }).not.toThrow();
  });

  it('should no longer update subscribers after being destroyed', () => {
    const controller = new MockController({ count: 0 }, mockControllerSchema);
    const listener1 = sinon.stub();
    const listener2 = sinon.stub();

    controller.subscribe(listener1);
    controller.subscribe(listener2);
    controller.destroy();
    controller.update(() => {
      return { count: 1 };
    });

    expect(listener1.callCount).toEqual(0);
    expect(listener2.callCount).toEqual(0);
  });
});

describe('getAnonymizedState', () => {
  it('should return empty state', () => {
    expect(getAnonymizedState({}, {})).toEqual({});
  });

  it('should return empty state when no properties are anonymized', () => {
    const anonymizedState = getAnonymizedState({ count: 1 }, { count: { anonymous: false, persist: false } });
    expect(anonymizedState).toEqual({});
  });

  it('should return state that is already anonymized', () => {
    const anonymizedState = getAnonymizedState(
      {
        password: 'secret password',
        privateKey: '123',
        network: 'mainnet',
        tokens: ['DAI', 'USDC'],
      },
      {
        password: {
          anonymous: false,
          persist: false,
        },
        privateKey: {
          anonymous: false,
          persist: false,
        },
        network: {
          anonymous: true,
          persist: false,
        },
        tokens: {
          anonymous: true,
          persist: false,
        },
      },
    );
    expect(anonymizedState).toEqual({ network: 'mainnet', tokens: ['DAI', 'USDC'] });
  });

  it('should use anonymizing function to anonymize state', () => {
    const anonymizeTransactionHash = (hash: string) => {
      return hash.split('').reverse().join('');
    };

    const anonymizedState = getAnonymizedState(
      {
        transactionHash: '0x1234',
      },
      {
        transactionHash: {
          anonymous: anonymizeTransactionHash,
          persist: false,
        },
      },
    );

    expect(anonymizedState).toEqual({ transactionHash: '4321x0' });
  });
});

describe('getPersistentState', () => {
  it('should return empty state', () => {
    expect(getPersistentState({}, {})).toEqual({});
  });

  it('should return empty state when no properties are persistent', () => {
    const persistentState = getPersistentState({ count: 1 }, { count: { anonymous: false, persist: false } });
    expect(persistentState).toEqual({});
  });

  it('should return persistent state', () => {
    const persistentState = getPersistentState(
      {
        password: 'secret password',
        privateKey: '123',
        network: 'mainnet',
        tokens: ['DAI', 'USDC'],
      },
      {
        password: {
          anonymous: false,
          persist: true,
        },
        privateKey: {
          anonymous: false,
          persist: true,
        },
        network: {
          anonymous: false,
          persist: false,
        },
        tokens: {
          anonymous: false,
          persist: false,
        },
      },
    );
    expect(persistentState).toEqual({ password: 'secret password', privateKey: '123' });
  });
});