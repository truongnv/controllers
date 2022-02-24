import { ControllerMessenger } from '../ControllerMessenger';
import { GetSubjectMetadataState } from '../subject-metadata';
import {
  ControllerActions,
  RateLimitStateChange,
  RateLimitController,
  RateLimitMessenger,
  GetRateLimitState,
  ApiType,
  CallAPI,
} from './RateLimitController';

const name = 'RateLimitController';

/**
 * Constructs a unrestricted controller messenger.
 *
 * @returns A unrestricted controller messenger.
 */
function getUnrestrictedMessenger() {
  return new ControllerMessenger<
    GetRateLimitState | CallAPI | GetSubjectMetadataState,
    RateLimitStateChange
  >();
}

/**
 * Constructs a restricted controller messenger.
 *
 * @param controllerMessenger - An optional unrestricted messenger
 * @returns A restricted controller messenger.
 */
function getRestrictedMessenger(
  controllerMessenger = getUnrestrictedMessenger(),
) {
  return controllerMessenger.getRestricted<
    typeof name,
    ControllerActions['type'] | GetSubjectMetadataState['type'],
    never
  >({
    name,
    allowedActions: ['RateLimitController:call'],
  }) as RateLimitMessenger;
}

const origin = 'snap_test';
const message = 'foo';

describe('RateLimitController', () => {
  jest.useFakeTimers();

  it('action: RateLimitController:call', async () => {
    const unrestricted = getUnrestrictedMessenger();
    const messenger = getRestrictedMessenger(unrestricted);

    const showNativeNotification = jest.fn();
    const controller = new RateLimitController({
      showNativeNotification,
      messenger,
    });
    const showSpy = jest
      .spyOn(controller, 'call')
      .mockImplementationOnce(() => true);
    expect(
      await unrestricted.call('RateLimitController:call', origin, {
        type: ApiType.showNativeNotification,
        args: { title: origin, message },
      }),
    ).toBe(true);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it('uses showNativeNotification to show a notification', () => {
    const messenger = getRestrictedMessenger();

    const showNativeNotification = jest.fn();
    const controller = new RateLimitController({
      showNativeNotification,
      messenger,
    });
    expect(
      controller.call(origin, {
        type: ApiType.showNativeNotification,
        args: { title: origin, message },
      }),
    ).toBe(true);
    expect(showNativeNotification).toHaveBeenCalledWith(origin, message);
  });

  it('returns false if rate-limited', () => {
    const messenger = getRestrictedMessenger();
    const showNativeNotification = jest.fn();
    const controller = new RateLimitController({
      showNativeNotification,
      messenger,
      rateLimitCount: 1,
    });

    expect(
      controller.call(origin, {
        type: ApiType.showNativeNotification,
        args: { title: origin, message },
      }),
    ).toBe(true);

    expect(
      controller.call(origin, {
        type: ApiType.showNativeNotification,
        args: { title: origin, message },
      }),
    ).toBe(false);
    expect(showNativeNotification).toHaveBeenCalledTimes(1);
    expect(showNativeNotification).toHaveBeenCalledWith(origin, message);
  });

  it('rate limit is reset after timeout', () => {
    const messenger = getRestrictedMessenger();
    const showNativeNotification = jest.fn();
    const controller = new RateLimitController({
      showNativeNotification,
      messenger,
      rateLimitCount: 1,
    });
    expect(
      controller.call(origin, {
        type: ApiType.showNativeNotification,
        args: { title: origin, message },
      }),
    ).toBe(true);
    jest.runAllTimers();
    expect(
      controller.call(origin, {
        type: ApiType.showNativeNotification,
        args: { title: origin, message },
      }),
    ).toBe(true);
    expect(showNativeNotification).toHaveBeenCalledTimes(2);
    expect(showNativeNotification).toHaveBeenCalledWith(origin, message);
  });
});