/**
 * @constants events
 * @description Socket.io event name constants.
 */
export const SOCKET_EVENTS = {
  // Connection
  CONNECT:    'connect',
  DISCONNECT: 'disconnect',

  // Matchmaking
  JOIN_ROOM:            'joinRoom',
  LEAVE_ROOM:           'leaveRoom',
  MATCHMAKING_STATUS:   'matchmakingStatus',
  MATCHMAKING_TIMEOUT:  'matchmakingTimeout',
  MATCH_PLAYERS:        'matchPlayers',
  GET_QUEUE_STATUS:     'getQueueStatus',
  QUEUE_STATUS:         'queueStatus',
  CHECK_MATCHMAKING:    'checkMatchmaking',
  MATCHMAKING_CHECK:    'matchmakingCheck',

  // Battle
  JOIN_BATTLE:          'joinBattle',
  JOINED_BATTLE:        'joinedBattle',
  START_BATTLE:         'startBattle',
  NEXT_QUESTION:        'nextQuestion',
  SUBMIT_ANSWER_LIVE:   'submitAnswerLive',
  ANSWER_RESULT:        'answerResult',
  SCORE_UPDATE:         'scoreUpdate',
  BATTLE_FINISHED:      'battleFinished',
  BATTLE_STATE:         'battleState',
  BATTLE_ERROR:         'battleError',
  PLAYER_JOINED:        'playerJoined',
  PLAYER_DISCONNECTED:  'playerDisconnected',
  GET_BATTLE_STATUS:    'getBattleStatus',
  SYNC_TIMER:           'syncTimer',
  TIMER_SYNC:           'timerSync',
  BATTLE_CHAT:          'battleChat',
  BATTLE_MESSAGE:       'battleMessage',
};