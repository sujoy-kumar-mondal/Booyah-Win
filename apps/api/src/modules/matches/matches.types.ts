export interface CreateMatchDto {
  tierId: string;
  startTime: string;
  mapName?: string;
}

export interface MatchStaffDto {
  id: string;
  tierId: string;
  gameMode: string;
  teamMode: string;
  entryFee: string;
  killPrice: string;
  minKillsForReward: number;
  positionPrizes: Record<string, string>;
  maxPlayers: number;
  minPlayers: number;
  startTime: string;
  roomId?: string;
  roomPassword?: string;
  status: string;
  cancelReason: string | null;
  mapName?: string;
  map?: string;
  createdBy: string;
  createdAt: string;
  joinedCount: number;
  seatsTaken?: number;
}

export interface JoinedPlayerDto {
  userId: string;
  name: string;
  username?: string;
  ffId: string;
  ffName: string;
  teamId: string | null;
  paidAddMoney: string;
  paidCashback: string;
  paidWinning: string;
  refundedAt: string | null;
  joinedAt: string;
  kills?: number | null;
  reward?: string | null;
}

export interface MatchTeamStaffDto {
  id: string;
  name: string | null;
  size: number;
  status: string;
  leaderId: string;
  memberUserIds: string[];
}

export interface MatchDetailStaffDto extends MatchStaffDto {
  players: JoinedPlayerDto[];
  teams: MatchTeamStaffDto[];
}

export interface MatchUserDto {
  id: string;
  gameMode: string;
  teamMode: string;
  entryFee: string;
  prizes: {
    positions: Record<string, string>;
    killPrice: string;
    minKillsForReward: number;
  };
  joinedPlayers: number;
  seatsTaken: number;
  maxPlayers: number;
  minPlayers: number;
  startTime: string;
  status: string;
  hasJoined: boolean;
  isInTeam: boolean;
  isTeamLeader?: boolean;
  canReplaceTeammate?: boolean;
  hasReplacedTeammate?: boolean;
  roomId?: string;
  roomPassword?: string;
  cancelReason?: string;
  mapName?: string;
  map?: string;
}

export interface CreateTeamDto {
  teamName?: string;
  memberFfIds?: string[];
  memberUsernames?: string[];
}

export interface MyTeamMemberDto {
  userId: string;
  username?: string;
  name: string;
  ffName: string;
  ffId: string;
  isLeader: boolean;
  status: string;
}

export interface MyTeamDto {
  id: string;
  name: string | null;
  size: number;
  status: string;
  isLeader: boolean;
  replaceCount: number;
  members: MyTeamMemberDto[];
}

export interface TeamInviteDto {
  id: string;
  teamId: string;
  teamName: string | null;
  teamSize: number;
  leaderId: string;
  leaderName?: string;
  leaderFfId?: string;
  leaderFfName?: string;
  invitedUserId: string;
  invitedUserName?: string;
  invitedUserFfId?: string;
  invitedUserFfName?: string;
  matchId: string;
  gameMode?: string;
  teamMode?: string;
  entryFee?: string;
  startTime?: string;
  matchStatus?: string;
  killPrice?: string;
  firstPlacePrize?: string;
  positionPrizes?: Record<string, string>;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  respondedAt: string | null;
}

export interface TeamMemberDto {
  userId: string;
  username?: string;
  freeFireId: string;
  ffName?: string;
  name: string;
  role: 'leader' | 'member';
  status: 'confirmed' | 'pending' | 'declined' | 'expired';
}

export interface TeamDto {
  id: string;
  matchId: string;
  leaderId: string;
  name: string | null;
  size: number;
  status: 'forming' | 'confirmed' | 'disbanded';
  createdAt: string;
  members: TeamMemberDto[];
}

export interface ReplaceInviteItemDto {
  oldFfId?: string;
  newFfId?: string;
  oldUsername?: string;
  newUsername?: string;
}

export interface ReplaceInviteDto {
  oldFfId?: string;
  newFfId?: string;
  oldUsername?: string;
  newUsername?: string;
  replacements?: ReplaceInviteItemDto[];
}

export interface LeaderboardTickRefreshDto {
  weekly: boolean;
  monthly: boolean;
  overall: boolean;
  timestamp: string;
}

export interface TickResultDto {
  deletedOtpsCount: number;
  disbandedTeamsCount: number;
  cancelledMatchesCount: number;
  expiredInvitesCount: number;
  leaderboardRefreshed?: LeaderboardTickRefreshDto;
  timestamp: string;
}
