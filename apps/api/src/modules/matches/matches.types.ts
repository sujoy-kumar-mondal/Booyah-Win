export interface CreateMatchDto {
  tierId: string;
  startTime: string;
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
  createdBy: string;
  createdAt: string;
  joinedCount: number;
  seatsTaken?: number;
}

export interface JoinedPlayerDto {
  userId: string;
  name: string;
  ffId: string;
  ffName: string;
  teamId?: string | null;
  paidAddMoney: string;
  paidCashback: string;
  paidWinning: string;
  refundedAt: string | null;
  joinedAt: string;
}

export interface MatchDetailStaffDto extends MatchStaffDto {
  players: JoinedPlayerDto[];
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
  roomId?: string;
  roomPassword?: string;
}

export interface CreateTeamDto {
  teamName?: string;
  memberFfIds: string[];
}

export interface TeamInviteDto {
  id: string;
  teamId: string;
  teamName: string | null;
  teamSize: number;
  leaderId: string;
  leaderName?: string;
  leaderFfId?: string;
  matchId: string;
  gameMode?: string;
  teamMode?: string;
  entryFee?: string;
  startTime?: string;
  matchStatus?: string;
  invitedUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  respondedAt: string | null;
}

export interface TeamMemberDto {
  userId: string;
  freeFireId: string;
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

export interface ReplaceInviteDto {
  oldFfId: string;
  newFfId: string;
}

export interface TickResultDto {
  deletedOtpsCount: number;
  disbandedTeamsCount: number;
  cancelledMatchesCount: number;
  expiredInvitesCount: number;
  timestamp: string;
}
