import base64
import typing
from typing import Callable, Dict, Hashable, Iterable, Iterator, List, Optional, SupportsInt, Tuple, TypeAlias, Union
from dataclasses import dataclass
from typing import Optional, Union, Literal
import struct
import zlib

if typing.TYPE_CHECKING:
    from typing_extensions import Self


Color: TypeAlias = bool
RED: Color = False
BLUE: Color = True
COLORS: List[Color] = [RED, BLUE]
COLOR_NAMES: List[str] = ["red", "blue"]

PieceType: TypeAlias = int
HQ: PieceType = 1
INFANTRY: PieceType = 2
ARMORED_INFANTRY: PieceType = 3
AIRBORNE_INFANTRY: PieceType = 4
ARTILLERY: PieceType = 5
ARMORED_ARTILLERY: PieceType = 6
HEAVY_ARTILLERY: PieceType = 7

PIECE_TYPES: List[PieceType] = [HQ, INFANTRY, ARMORED_INFANTRY, AIRBORNE_INFANTRY, ARTILLERY, ARMORED_ARTILLERY, HEAVY_ARTILLERY]
PIECE_SYMBOLS = [None, "Q", "I", "F", "P", "R", "T", "H"]
PIECE_NAMES = [None, "HQ", "INFANTRY", "ARMORED_INFANTRY", "AIRBORNE_INFANTRY", "ARTILLERY", "ARMORED_ARTILLERY", "HEAVY_ARTILLERY"]

UNICODE_PIECE_SYMBOLS = {
    "Q": "★", "q": "☆",
    "I": "♟", "i": "♙",
    "F": "▲", "f": "△",
    "P": "☂", "p": "⛱",
    "R": "♠", "r": "♤",
    "T": "♦", "t": "♢",
    "H": "☗", "h": "☖",
}

FILE_NAMES = ["a", "b", "c", "d", "e", "f", "g", "h"]

RANK_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8"]

STARTING_FEN = "qr↓6/iii5/8/8/8/8/5III/6R↑Q IIIIIFFFPRRTH iiiiifffprrth r"
"""The FEN for the standard GHQ starting position."""

Orientation: TypeAlias = int

ORIENT_N: Orientation = 0
ORIENT_NE: Orientation = 1
ORIENT_E: Orientation = 2
ORIENT_SE: Orientation = 3
ORIENT_S: Orientation = 4
ORIENT_SW: Orientation = 5
ORIENT_W: Orientation = 6
ORIENT_NW: Orientation = 7

CARDINAL_DIRECTIONS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"]


def bits_to_orientation(bit0: int, bit1: int, bit2: int) -> Optional[Orientation]:
    return (bit2 << 2) | (bit1 << 1) | bit0

def orientation_to_bits(orientation: Orientation) -> List[int]:
    return [orientation & 1, (orientation >> 1) & 1, orientation >> 2]

def orientation_to_cardinal(orientation: int) -> str:
    if orientation < 0 or orientation >= 8:
        raise ValueError("Orientation out of bounds")
    return CARDINAL_DIRECTIONS[orientation]

def cardinal_to_orientation(cardinal: str) -> Optional[int]:
    try:
        return CARDINAL_DIRECTIONS.index(cardinal)
    except ValueError:
        return None

def rotate_orientations_180(bit0: int, bit1: int, bit2: int) -> Tuple[int, int, int]:
    return (bit0, bit1, bit2 ^ BB_ALL)

def rotate_orientations_90(bit0: int, bit1: int, bit2: int) -> Tuple[int, int, int]:
    return (bit0, bit1 ^ BB_ALL, bit2 ^ bit1)

def piece_symbol(piece_type: PieceType) -> str:
    return typing.cast(str, PIECE_SYMBOLS[piece_type])


def piece_name(piece_type: PieceType) -> str:
    return typing.cast(str, PIECE_NAMES[piece_type])


Square: TypeAlias = int
A1: Square = 0
B1: Square = 1
C1: Square = 2
D1: Square = 3
E1: Square = 4
F1: Square = 5
G1: Square = 6
H1: Square = 7
A2: Square = 8
B2: Square = 9
C2: Square = 10
D2: Square = 11
E2: Square = 12
F2: Square = 13
G2: Square = 14
H2: Square = 15
A3: Square = 16
B3: Square = 17
C3: Square = 18
D3: Square = 19
E3: Square = 20
F3: Square = 21
G3: Square = 22
H3: Square = 23
A4: Square = 24
B4: Square = 25
C4: Square = 26
D4: Square = 27
E4: Square = 28
F4: Square = 29
G4: Square = 30
H4: Square = 31
A5: Square = 32
B5: Square = 33
C5: Square = 34
D5: Square = 35
E5: Square = 36
F5: Square = 37
G5: Square = 38
H5: Square = 39
A6: Square = 40
B6: Square = 41
C6: Square = 42
D6: Square = 43
E6: Square = 44
F6: Square = 45
G6: Square = 46
H6: Square = 47
A7: Square = 48
B7: Square = 49
C7: Square = 50
D7: Square = 51
E7: Square = 52
F7: Square = 53
G7: Square = 54
H7: Square = 55
A8: Square = 56
B8: Square = 57
C8: Square = 58
D8: Square = 59
E8: Square = 60
F8: Square = 61
G8: Square = 62
H8: Square = 63
SQUARES: List[Square] = list(range(64))

SQUARE_NAMES = [f + r for r in RANK_NAMES for f in FILE_NAMES]

def square_mirror(square: Square) -> Square:
    """Mirrors the square vertically."""
    return square ^ 0x38

SQUARES_180: List[Square] = [square_mirror(sq) for sq in SQUARES]

FILE_NAMES = ["a", "b", "c", "d", "e", "f", "g", "h"]
RANK_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8"]
SQUARE_NAMES = [f + r for r in RANK_NAMES for f in FILE_NAMES]


def parse_square(name: str) -> Square:
    return SQUARE_NAMES.index(name)


def square_name(square: Square) -> str:
    return SQUARE_NAMES[square]


def square(file_index: int, rank_index: int) -> Square:
    return rank_index * 8 + file_index


def square_file(square: Square) -> int:
    return square & 7


def square_rank(square: Square) -> int:
    return square >> 3


def square_distance(a: Square, b: Square) -> int:
    return max(abs(square_file(a) - square_file(b)), abs(square_rank(a) - square_rank(b)))


def square_manhattan_distance(a: Square, b: Square) -> int:
    return abs(square_file(a) - square_file(b)) + abs(square_rank(a) - square_rank(b))


Bitboard: TypeAlias = int
BB_EMPTY: Bitboard = 0
BB_ALL: Bitboard = 0xffff_ffff_ffff_ffff

BB_SQUARES = [1 << sq for sq in range(64)]

BB_CORNERS = BB_SQUARES[0] | BB_SQUARES[7] | BB_SQUARES[56] | BB_SQUARES[63]

BB_FILES = [
    BB_FILE_A,
    BB_FILE_B,
    BB_FILE_C,
    BB_FILE_D,
    BB_FILE_E,
    BB_FILE_F,
    BB_FILE_G,
    BB_FILE_H,
] = [0x0101010101010101 << i for i in range(8)]

BB_RANKS = [
    BB_RANK_1,
    BB_RANK_2,
    BB_RANK_3,
    BB_RANK_4,
    BB_RANK_5,
    BB_RANK_6,
    BB_RANK_7,
    BB_RANK_8,
] = [0xff << (8 * i) for i in range(8)]

BB_LIGHT_SQUARES = 0x55aa55aa55aa55aa
BB_DARK_SQUARES = 0xaa55aa55aa55aa55

def lsb(bb: Bitboard) -> int:
    return (bb & -bb).bit_length() - 1

def scan_forward(bb: Bitboard) -> typing.Iterator[Square]:
    while bb:
        r = bb & -bb
        yield r.bit_length() - 1
        bb ^= r

def msb(bb: Bitboard) -> int:
    return bb.bit_length() - 1

def msb_n(bb: Bitboard, n: int) -> Bitboard:
    result = BB_EMPTY
    for _ in range(n):
        if not bb:
            break
        msb_pos = msb(bb)
        result |= BB_SQUARES[msb_pos]
        bb &= ~BB_SQUARES[msb_pos]
    return result

def scan_reversed(bb: Bitboard) -> typing.Iterator[Square]:
    while bb:
        r = bb.bit_length() - 1
        yield r
        bb ^= BB_SQUARES[r]

def popcount(bb: Bitboard) -> int:
    return bin(bb).count("1")

def flip_vertical(bb: Bitboard) -> Bitboard:
    # https://www.chessprogramming.org/Flipping_Mirroring_and_Rotating#FlipVertically
    bb = ((bb >> 8) & 0x00ff_00ff_00ff_00ff) | ((bb & 0x00ff_00ff_00ff_00ff) << 8)
    bb = ((bb >> 16) & 0x0000_ffff_0000_ffff) | ((bb & 0x0000_ffff_0000_ffff) << 16)
    bb = (bb >> 32) | ((bb & 0x0000_0000_ffff_ffff) << 32)
    return bb

def flip_horizontal(bb: Bitboard) -> Bitboard:
    # https://www.chessprogramming.org/Flipping_Mirroring_and_Rotating#MirrorHorizontally
    bb = ((bb >> 1) & 0x5555_5555_5555_5555) | ((bb & 0x5555_5555_5555_5555) << 1)
    bb = ((bb >> 2) & 0x3333_3333_3333_3333) | ((bb & 0x3333_3333_3333_3333) << 2)
    bb = ((bb >> 4) & 0x0f0f_0f0f_0f0f_0f0f) | ((bb & 0x0f0f_0f0f_0f0f_0f0f) << 4)
    return bb

def flip_diag_a1h8(bb: Bitboard) -> Bitboard:
    # https://www.chessprogramming.org/Flipping_Mirroring_and_Rotating#FlipabouttheDiagonal
    t = 0x0f0f_0f0f_0000_0000 & (bb ^ (bb << 28))
    bb ^= t ^ (t >> 28)
    t = 0x3333_0000_3333_0000 & (bb ^ (bb << 14))
    bb ^= t ^ (t >> 14)
    t = 0x5500_5500_5500_5500 & (bb ^ (bb << 7))
    bb ^= t ^ (t >> 7)
    return bb

def rotate_90_clockwise(bb: Bitboard) -> Bitboard:
    return flip_vertical(flip_diag_a1h8(bb))

def _sliding_moves(square: Square, occupied: Bitboard, deltas: Iterable[int]) -> Bitboard:
    attacks = BB_EMPTY

    for delta in deltas:
        sq = square

        while True:
            sq += delta
            if not (0 <= sq < 64) or square_distance(sq, sq - delta) > 2:
                break

            attacks |= BB_SQUARES[sq]

            if occupied & BB_SQUARES[sq]:
                break

    return attacks


def _step_moves(square: Square, deltas: Iterable[int]) -> Bitboard:
    return _sliding_moves(square, BB_ALL, deltas)


BB_REGULAR_MOVES: List[Bitboard] = [_step_moves(sq, [9, 8, 7, 1, -9, -8, -7, -1]) for sq in SQUARES]
BB_ARMORED_MOVES: List[Bitboard] = [_step_moves(sq, [9, 8, 7, 1, -9, -8, -7, -1, 18, 16, 14, 2, -18, -16, -14, -2]) for sq in SQUARES]

BB_ADJACENT_SQUARES: List[Bitboard] = [_step_moves(sq, [8, 1, -8, -1]) for sq in SQUARES]

"""
 0  1  2  3  4  5  6  7
 8  9 10 11 12 13 14 15
16 17 18 19 20 21 22 23
24 25 26 27 28 29 30 31
32 33 34 35 36 37 38 39
40 41 42 43 44 45 46 47
48 49 50 51 52 53 54 55
56 57 58 59 60 61 62 63
"""


def _edges(square: Square) -> Bitboard:
    return (((BB_RANK_1 | BB_RANK_8) & ~BB_RANKS[square_rank(square)]) |
            ((BB_FILE_A | BB_FILE_H) & ~BB_FILES[square_file(square)]))

def _carry_rippler(mask: Bitboard) -> Iterator[Bitboard]:
    # Carry-Rippler trick to iterate subsets of mask.
    subset = BB_EMPTY
    while True:
        yield subset
        subset = (subset - mask) & mask
        if not subset:
            break


def _attack_table(deltas: List[int]) -> Tuple[List[Bitboard], List[Dict[Bitboard, Bitboard]]]:
    mask_table: List[Bitboard] = []
    attack_table: List[Dict[Bitboard, Bitboard]] = []

    for square in SQUARES:
        attacks = {}

        mask = _sliding_moves(square, 0, deltas) & ~_edges(square)
        for subset in _carry_rippler(mask):
            attacks[subset] = _sliding_moves(square, subset, deltas)

        attack_table.append(attacks)
        mask_table.append(mask)

    return mask_table, attack_table

BB_DIAG_MASKS, BB_DIAG_ATTACKS = _attack_table([-9, -7, 7, 9])
BB_FILE_MASKS, BB_FILE_ATTACKS = _attack_table([-8, 8])
BB_RANK_MASKS, BB_RANK_ATTACKS = _attack_table([-1, 1])

def _rays() -> List[List[Bitboard]]:
    rays: List[List[Bitboard]] = []
    for a, bb_a in enumerate(BB_SQUARES):
        rays_row: List[Bitboard] = []
        for b, bb_b in enumerate(BB_SQUARES):
            if BB_DIAG_ATTACKS[a][0] & bb_b:
                rays_row.append((BB_DIAG_ATTACKS[a][0] & BB_DIAG_ATTACKS[b][0]) | bb_a | bb_b)
            elif BB_RANK_ATTACKS[a][0] & bb_b:
                rays_row.append(BB_RANK_ATTACKS[a][0] | bb_a)
            elif BB_FILE_ATTACKS[a][0] & bb_b:
                rays_row.append(BB_FILE_ATTACKS[a][0] | bb_a)
            else:
                rays_row.append(BB_EMPTY)
        rays.append(rays_row)
    return rays

BB_RAYS = _rays()

def ray(a: Square, b: Square) -> Bitboard:
    return BB_RAYS[a][b]

def between(a: Square, b: Square) -> Bitboard:
    bb = BB_RAYS[a][b] & ((BB_ALL << a) ^ (BB_ALL << b))
    return bb & (bb - 1)

def between_inclusive_end(a: Square, b: Square) -> Bitboard:
    bb = BB_RAYS[a][b] & ((BB_ALL << a) ^ (BB_ALL << b))
    return (bb & (bb - 1)) | BB_SQUARES[b]

@dataclass
class Outcome:
    """
    Information about the outcome of an ended game, usually obtained from
    :func:`Board.outcome()`.
    """

    termination: str # TODO(tyler): add enum
    """The reason for the game to have ended."""

    winner: Optional[Color]
    """The winning color or ``None`` if drawn."""

    def result(self) -> str:
        """Returns ``1-0``, ``0-1`` or ``1/2-1/2``."""
        return "1/2-1/2" if self.winner is None else ("1-0" if self.winner else "0-1")


def is_artillery(piece_type: PieceType) -> bool:
    return piece_type == ARTILLERY or piece_type == ARMORED_ARTILLERY or piece_type == HEAVY_ARTILLERY

def is_hq(piece_type: PieceType) -> bool:
    return piece_type == HQ

def is_infantry(piece_type: PieceType) -> bool:
    return piece_type == INFANTRY or piece_type == ARMORED_INFANTRY or piece_type == AIRBORNE_INFANTRY

def is_airborne(piece_type: PieceType) -> bool:
    return piece_type == AIRBORNE_INFANTRY

def is_armored(piece_type: Optional[PieceType]) -> bool:
    if piece_type is None:
        return False
    return piece_type == ARMORED_INFANTRY or piece_type == ARMORED_ARTILLERY

class Piece:
    piece_type: PieceType
    color: Color
    orientation: Optional[Orientation]

    def __init__(self, piece_type: PieceType, color: Color, orientation: Optional[Orientation] = None) -> None:
        self.piece_type = piece_type
        self.color = color
        self.orientation = orientation

    def symbol(self) -> str:
        symbol = piece_symbol(self.piece_type)
        base = symbol.upper() if self.color == RED else symbol.lower()
        if self.orientation is not None:
            return base + orientation_to_cardinal(self.orientation)
        return base

    def unicode_symbol(self, *, invert_color: bool = False) -> str:
        symbol = self.symbol()
        color = not self.color if invert_color else self.color
        return UNICODE_PIECE_SYMBOLS[symbol.upper() if color == RED else symbol.lower()]

    def __hash__(self) -> int:
        return hash((self.piece_type, self.color, self.orientation))

    def __repr__(self) -> str:
        return f"Piece.from_symbol('{self.symbol()}')"

    def __str__(self) -> str:
        return self.symbol()

    @classmethod
    def from_symbol(cls, symbol: str) -> "Piece":
        if len(symbol) == 1:
            piece_type = PIECE_SYMBOLS.index(symbol.upper())
            color = not symbol.isupper()
            return cls(piece_type, color)
        else:
            piece_type = PIECE_SYMBOLS.index(symbol[0].upper())
            color = not symbol[0].isupper()
            orientation = cardinal_to_orientation(symbol[1])
            return cls(piece_type, color, orientation)

class ReserveFleet:
    def __init__(self) -> None:
        self._counts: Dict[PieceType, int] = {
            INFANTRY: 0,
            ARMORED_INFANTRY: 0,
            AIRBORNE_INFANTRY: 0,
            ARTILLERY: 0,
            ARMORED_ARTILLERY: 0,
            HEAVY_ARTILLERY: 0,
            HQ: 0,
        }

    def __iter__(self) -> Iterator[Tuple[PieceType, int]]:
        for piece_type, count in self._counts.items():
            if count > 0:
                yield piece_type, count

    def get_count(self, piece_type: PieceType) -> int:
        return self._counts.get(piece_type, 0)

    def add(self, piece_type: PieceType, count: int = 1) -> None:
        self._counts[piece_type] = self._counts.get(piece_type, 0) + count

    def remove(self, piece_type: PieceType, count: int = 1) -> None:
        current = self._counts.get(piece_type, 0)
        if current < count:
            raise ValueError(f"Not enough pieces in reserve: {piece_name(piece_type)}")
        self._counts[piece_type] = current - count
        if self._counts[piece_type] == 0:
            del self._counts[piece_type]

    def to_fen(self, color: Color) -> str:
        return "".join(
            piece_symbol(pt).upper() if color == RED else piece_symbol(pt).lower()
            for pt, count in sorted(self._counts.items())
            for _ in range(count)
        )

    @classmethod
    def from_fen(cls, fen: str) -> "ReserveFleet":
        reserve = cls()
        for c in fen:
            piece = Piece.from_symbol(c)
            reserve.add(piece.piece_type)
        return reserve

    def to_ints(self) -> List[int]:
        return [
            self._counts.get(INFANTRY, 0),
            self._counts.get(ARMORED_INFANTRY, 0),
            self._counts.get(AIRBORNE_INFANTRY, 0),
            self._counts.get(ARTILLERY, 0),
            self._counts.get(ARMORED_ARTILLERY, 0),
            self._counts.get(HEAVY_ARTILLERY, 0),
        ]

    @classmethod
    def from_ints(cls, ints: List[int]) -> "ReserveFleet":
        reserve = cls()
        reserve._counts = {
            INFANTRY: ints[0],
            ARMORED_INFANTRY: ints[1],
            AIRBORNE_INFANTRY: ints[2],
            ARTILLERY: ints[3],
            ARMORED_ARTILLERY: ints[4],
            HEAVY_ARTILLERY: ints[5],
        }
        return reserve

    def copy(self) -> "ReserveFleet":
        new = type(self)()
        new._counts = self._counts.copy()
        return new


@dataclass(unsafe_hash=True)
class Move:
    """
    Represents a move in the game. Can be one of:
    - Reinforce: Place a new unit
    - Move: Move a unit
    - MoveAndOrient: Move and orient a unit
    - AutoCapture: Automatically capture a piece (e.g. bombardments or free captures)
    - Skip: Skip turn
    """

    name: Literal["Reinforce", "Move", "MoveAndOrient", "AutoCapture", "Skip"]
    """The type of move."""

    from_square: Optional[Square] = None
    """The source square for Move and MoveAndOrient moves."""

    to_square: Optional[Square] = None
    """The target square for all moves except Skip."""

    unit_type: Optional[PieceType] = None
    """The unit type for Reinforce moves."""

    orientation: Optional[int] = None
    """The orientation for MoveAndOrient moves."""

    capture_preference: Optional[Square] = None
    """Optional capture preference for Reinforce and Move moves."""

    auto_capture_type: Optional[Literal["bombard", "free"]] = None
    """The type of auto-capture to perform."""

    def uci(self) -> str:
        if self.name == "Skip":
            return "skip"

        if self.name == "Reinforce":
            result = "r"
            if self.unit_type is not None:
                result += piece_symbol(self.unit_type).lower()
            if self.to_square is not None:
                result += SQUARE_NAMES[self.to_square]
            if self.capture_preference is not None:
                result += "x" + SQUARE_NAMES[self.capture_preference]
            return result

        if self.name == "Move":
            if self.from_square is None or self.to_square is None:
                raise ValueError("from_square and to_square must be set for Move and MoveAndOrient moves")
            result = SQUARE_NAMES[self.from_square] + SQUARE_NAMES[self.to_square]
            if self.capture_preference is not None:
                result += "x" + SQUARE_NAMES[self.capture_preference]
            return result

        if self.name == "MoveAndOrient":
            if self.from_square is None or self.to_square is None:
                raise ValueError("from_square and to_square must be set for Move and MoveAndOrient moves")
            result = SQUARE_NAMES[self.from_square] + SQUARE_NAMES[self.to_square]
            if self.orientation is not None:
                result += orientation_to_cardinal(self.orientation)
            return result

        if self.name == "AutoCapture":
            if self.capture_preference is None:
                raise ValueError("capture_preference must be set for AutoCapture moves")
            result = "s"
            if self.auto_capture_type == "bombard":
                result += "b"
                result += SQUARE_NAMES[self.capture_preference]
            elif self.auto_capture_type == "free":
                result += "f"
                result += SQUARE_NAMES[self.capture_preference]
            return result


        return ""

    def __bool__(self) -> bool:
        return self.name != "Skip"

    def __repr__(self) -> str:
        return f"Move.from_uci({self.uci()!r})"

    def __str__(self) -> str:
        return self.uci()

    @classmethod
    def from_uci(cls, uci: str) -> "Move":
        if not uci:
            raise ValueError("empty uci string")

        if uci == "skip":
            return cls(name="Skip")

        if uci.startswith("r"):
            parts = uci[1:]
            unit_type = None
            to_square = None
            capture_preference = None

            if parts and parts[0].isalpha():
                try:
                    unit_type = PIECE_SYMBOLS.index(parts[0].upper())
                    parts = parts[1:]
                except ValueError:
                    raise ValueError(f"invalid unit type: {parts[0]}")

            if len(parts) >= 2:
                try:
                    to_square = SQUARE_NAMES.index(parts[:2])
                    parts = parts[2:]
                except ValueError:
                    raise ValueError(f"invalid to square: {parts[:2]}")

            if parts.startswith("x") and len(parts) >= 3:
                try:
                    capture_preference = SQUARE_NAMES.index(parts[1:3])
                except ValueError:
                    raise ValueError(f"invalid capture square: {parts[1:3]}")

            return cls(name="Reinforce", unit_type=unit_type, to_square=to_square, capture_preference=capture_preference)

        if uci.startswith("s"):
            if len(uci) < 3:
                raise ValueError("invalid auto-capture move: too short")

            if uci[1] == "b" and len(uci) >= 4:
                try:
                    capture_preference = SQUARE_NAMES.index(uci[2:4])
                    return cls(name="AutoCapture", auto_capture_type="bombard", capture_preference=capture_preference)
                except ValueError:
                    raise ValueError(f"invalid capture square: {uci[2:4]}")
            elif uci[1] == "f" and len(uci) >= 4:
                try:
                    capture_preference = SQUARE_NAMES.index(uci[2:4])
                    return cls(name="AutoCapture", auto_capture_type="free", capture_preference=capture_preference)
                except ValueError:
                    raise ValueError(f"invalid square: {uci[2:4]}")
            else:
                raise ValueError(f"invalid auto-capture type: {uci[1]}")

        if len(uci) >= 4:
            try:
                from_square = SQUARE_NAMES.index(uci[:2])
                to_square = SQUARE_NAMES.index(uci[2:4])
                parts = uci[4:]
            except ValueError:
                raise ValueError(f"invalid squares: {uci[:4]}")

            if parts.startswith("x") and len(parts) >= 3:
                try:
                    capture_preference = SQUARE_NAMES.index(parts[1:3])
                    return cls(name="Move", from_square=from_square, to_square=to_square, capture_preference=capture_preference)
                except ValueError:
                    raise ValueError(f"invalid capture square: {parts[1:3]}")

            if parts and parts[0] in CARDINAL_DIRECTIONS:
                orientation = cardinal_to_orientation(parts[0])
                return cls(name="MoveAndOrient", from_square=from_square, to_square=to_square, orientation=orientation)

            return cls(name="Move", from_square=from_square, to_square=to_square)

        raise ValueError(f"invalid uci: {uci!r}")

    @classmethod
    def reinforce(cls, unit_type: PieceType, to_square: Square, capture_preference: Optional[Square] = None) -> "Move":
        """Creates a reinforce move."""
        if to_square < 0 or to_square >= 64:
            raise ValueError(f"invalid to square: {to_square}")
        if capture_preference is not None and (capture_preference < 0 or capture_preference >= 64):
            raise ValueError(f"invalid capture preference: {capture_preference}")
        return cls(name="Reinforce", unit_type=unit_type, to_square=to_square, capture_preference=capture_preference)

    @classmethod
    def move(cls, from_square: Square, to_square: Square, capture_preference: Optional[Square] = None) -> "Move":
        """Creates a move."""
        if from_square < 0 or from_square >= 64:
            raise ValueError(f"invalid from square: {from_square}")
        if to_square < 0 or to_square >= 64:
            raise ValueError(f"invalid to square: {to_square}")
        if capture_preference is not None and (capture_preference < 0 or capture_preference >= 64):
            raise ValueError(f"invalid capture preference: {capture_preference}")
        return cls(name="Move", from_square=from_square, to_square=to_square, capture_preference=capture_preference)

    @classmethod
    def move_and_orient(cls, from_square: Square, to_square: Square, orientation: Optional[int] = None) -> "Move":
        """Creates a move and orient move."""
        if from_square < 0 or from_square >= 64:
            raise ValueError(f"invalid from square: {from_square}")
        if to_square < 0 or to_square >= 64:
            raise ValueError(f"invalid to square: {to_square}")
        if orientation is not None and (orientation < 0 or orientation >= 8):
            raise ValueError(f"invalid orientation: {orientation}")
        return cls(name="MoveAndOrient", from_square=from_square, to_square=to_square, orientation=orientation)

    @classmethod
    def skip(cls) -> "Move":
        """Creates a skip move."""
        return cls(name="Skip")

    @classmethod
    def auto_capture_bombard(cls, square: Square) -> "Move":
        """Creates an auto-capture move."""
        if square < 0 or square >= 64:
            raise ValueError(f"invalid square: {square}")
        return cls(name="AutoCapture", auto_capture_type="bombard", capture_preference=square)

    @classmethod
    def auto_capture_free(cls, capture_preference: Square) -> "Move":
        """Creates an auto-capture move."""
        if capture_preference < 0 or capture_preference >= 64:
            raise ValueError(f"invalid capture preference: {capture_preference}")
        return cls(name="AutoCapture", auto_capture_type="free", capture_preference=capture_preference)

    def copy(self) -> "Move":
        return Move(**self.__dict__)

    def with_capture(self, capture_preference: Square) -> "Move":
        """Creates a move with a capture preference."""
        if capture_preference < 0 or capture_preference >= 64:
            raise ValueError(f"invalid capture preference: {capture_preference}")
        m = self.copy()
        m.capture_preference = capture_preference
        return m

class BaseBoard:
    # core game state
    occupied: Bitboard
    occupied_co: List[Bitboard]
    infantry: Bitboard
    armored_infantry: Bitboard
    airborne_infantry: Bitboard
    artillery: Bitboard
    armored_artillery: Bitboard
    heavy_artillery: Bitboard
    hq: Bitboard
    reserves: List[ReserveFleet]
    turn: Color
    turn_moves: int
    turn_auto_moves: int
    turn_pieces: Bitboard
    orientation_bit0: Bitboard
    orientation_bit1: Bitboard
    orientation_bit2: Bitboard
    bombarded_co: List[Bitboard]
    adjacent_infantry_squares_co: List[Bitboard]

    free_capture_clusters: Bitboard
    free_capture_enemies: Bitboard
    free_capture_num_allowed: Bitboard

    # optional game state
    move_stack: List[Move]

    # computed game state from move history
    did_offer_draw: bool
    did_accept_draw: bool

    def __init__(self, board_fen: Optional[str] = STARTING_FEN, skip_init: bool = False) -> None:
        if skip_init:
            return

        self._reset_board()

        if board_fen is not None:
            self._set_board_fen(board_fen)

    def _reset_board(self) -> None:
        self._clear_board()
        self._set_board_fen(STARTING_FEN)

    def reset_board(self) -> None:
        self._reset_board()

    def _clear_board(self) -> None:
        self.occupied = BB_EMPTY
        self.occupied_co = [BB_EMPTY, BB_EMPTY]
        self.infantry = BB_EMPTY
        self.armored_infantry = BB_EMPTY
        self.airborne_infantry = BB_EMPTY
        self.artillery = BB_EMPTY
        self.armored_artillery = BB_EMPTY
        self.heavy_artillery = BB_EMPTY
        self.hq = BB_EMPTY
        self.reserves = [ReserveFleet(), ReserveFleet()]
        self.turn = RED
        self.turn_moves = 0
        self.turn_auto_moves = 0
        self.turn_pieces = BB_EMPTY
        self.orientation_bit0 = BB_EMPTY  # First bit of orientation
        self.orientation_bit1 = BB_EMPTY  # Second bit of orientation
        self.orientation_bit2 = BB_EMPTY  # Third bit of orientation
        self.bombarded_co = [BB_EMPTY, BB_EMPTY]
        self.adjacent_infantry_squares_co = [BB_EMPTY, BB_EMPTY]
        self.free_capture_clusters = BB_EMPTY
        self.free_capture_enemies = BB_EMPTY
        self.free_capture_num_allowed = BB_EMPTY
        self.move_stack = []
        self.did_offer_draw = False
        self.did_accept_draw = False

    def serialize(self) -> str:
        # Pack all integers into a byte array
        # Q = unsigned long long (64 bits) for bitboards
        # b = signed char (8 bits) for turn state
        # I = unsigned int (32 bits) for reserve counts
        packed = struct.pack(
            ">21Q3b12I2b",  # big-endian format
            # units
            self.occupied,
            self.infantry,
            self.armored_infantry,
            self.airborne_infantry,
            self.artillery,
            self.armored_artillery,
            self.heavy_artillery,
            self.hq,
            # colors
            self.occupied_co[0],
            self.occupied_co[1],
            self.bombarded_co[0],
            self.bombarded_co[1],
            self.adjacent_infantry_squares_co[0],
            self.adjacent_infantry_squares_co[1],
            # orientation
            self.orientation_bit0,
            self.orientation_bit1,
            self.orientation_bit2,
            # mid-turn state
            self.turn_pieces,
            self.free_capture_clusters,
            self.free_capture_enemies,
            self.free_capture_num_allowed,
            # move state
            self.turn,
            self.turn_moves,
            self.turn_auto_moves,
            # reserve
            *self.reserves[0].to_ints(),
            *self.reserves[1].to_ints(),
            self.did_offer_draw,
            self.did_accept_draw,
        )
        return base64.b64encode(zlib.compress(packed)).decode()

    @classmethod
    def deserialize(cls, data: str) -> "BaseBoard":
        # Decompress the data first
        decompressed = zlib.decompress(base64.b64decode(data))

        # Unpack the byte array back into integers
        values = struct.unpack(">21Q3b12I2b", decompressed)

        board = cls(skip_init=True)

        # units
        board.occupied = values[0]
        board.infantry = values[1]
        board.armored_infantry = values[2]
        board.airborne_infantry = values[3]
        board.artillery = values[4]
        board.armored_artillery = values[5]
        board.heavy_artillery = values[6]
        board.hq = values[7]

        # colors
        board.occupied_co = [values[8], values[9]]
        board.bombarded_co = [values[10], values[11]]
        board.adjacent_infantry_squares_co = [values[12], values[13]]

        # orientation
        board.orientation_bit0 = values[14]
        board.orientation_bit1 = values[15]
        board.orientation_bit2 = values[16]

        # mid-turn state
        board.turn_pieces = values[17]
        board.free_capture_clusters = values[18]
        board.free_capture_enemies = values[19]
        board.free_capture_num_allowed = values[20]

        # move state
        board.turn = values[21]
        board.turn_moves = values[22]
        board.turn_auto_moves = values[23]

        # reserve
        board.reserves = [
            ReserveFleet.from_ints(list(values[24:30])),
            ReserveFleet.from_ints(list(values[30:36]))
        ]

        # move state
        board.did_offer_draw = values[36]
        board.did_accept_draw = values[37]

        # move stack
        board.move_stack = []

        return board

    def clear_board(self) -> None:
        self._clear_board()

    def is_red_turn(self) -> bool:
        return self.turn == RED

    def is_blue_turn(self) -> bool:
        return self.turn == BLUE

    def pieces_mask(self, piece_type: PieceType, color: Color) -> Bitboard:
        if piece_type == INFANTRY:
            bb = self.infantry
        elif piece_type == ARMORED_INFANTRY:
            bb = self.armored_infantry
        elif piece_type == AIRBORNE_INFANTRY:
            bb = self.airborne_infantry
        elif piece_type == ARTILLERY:
            bb = self.artillery
        elif piece_type == ARMORED_ARTILLERY:
            bb = self.armored_artillery
        elif piece_type == HEAVY_ARTILLERY:
            bb = self.heavy_artillery
        elif piece_type == HQ:
            bb = self.hq
        else:
            assert False, f"expected PieceType, got {piece_type!r}"

        return bb & self.occupied_co[color]

    def pieces(self, piece_type: PieceType, color: Color) -> "SquareSet":
        return SquareSet(self.pieces_mask(piece_type, color))

    def piece_at(self, square: Square) -> Optional[Piece]:
        piece_type = self.piece_type_at(square)
        if piece_type:
            mask = BB_SQUARES[square]
            color = bool(self.occupied_co[BLUE] & mask)
            orientation = self.get_orientation(square) if is_artillery(piece_type) else None
            return Piece(piece_type, color, orientation=orientation)
        else:
            return None

    def piece_type_at(self, square: Square) -> Optional[PieceType]:
        mask = BB_SQUARES[square]

        if not self.occupied & mask:
            return None
        elif self.infantry & mask:
            return INFANTRY
        elif self.armored_infantry & mask:
            return ARMORED_INFANTRY
        elif self.airborne_infantry & mask:
            return AIRBORNE_INFANTRY
        elif self.artillery & mask:
            return ARTILLERY
        elif self.armored_artillery & mask:
            return ARMORED_ARTILLERY
        elif self.heavy_artillery & mask:
            return HEAVY_ARTILLERY
        else:
            return HQ

    def color_at(self, square: Square, occupied_co: Optional[List[Bitboard]] = None) -> Optional[Color]:
        """Gets the color of the piece at the given square."""
        occupied_co = occupied_co if occupied_co is not None else self.occupied_co
        mask = BB_SQUARES[square]
        if occupied_co[RED] & mask:
            return RED
        elif occupied_co[BLUE] & mask:
            return BLUE
        else:
            return None

    def king(self, color: Color) -> Optional[Square]:
        for square in self.pieces(HQ, color):
            return square
        return None

    def _remove_piece_at(self, square: Square) -> Optional[PieceType]:
        piece_type = self.piece_type_at(square)
        piece_color = self.color_at(square)
        mask = BB_SQUARES[square]

        if piece_type == INFANTRY:
            self.infantry ^= mask
        elif piece_type == ARMORED_INFANTRY:
            self.armored_infantry ^= mask
        elif piece_type == AIRBORNE_INFANTRY:
            self.airborne_infantry ^= mask
        elif piece_type == ARTILLERY:
            self.artillery ^= mask
        elif piece_type == ARMORED_ARTILLERY:
            self.armored_artillery ^= mask
        elif piece_type == HEAVY_ARTILLERY:
            self.heavy_artillery ^= mask
        elif piece_type == HQ:
            self.hq ^= mask
        else:
            return None

        if piece_color is None or piece_type is None:
            raise ValueError(f"no piece at {square} (color: {piece_color}, type: {piece_type})")

        self.occupied ^= mask
        self.occupied_co[piece_color] ^= mask

        self.set_orientation(square, None)

        if is_artillery(piece_type):
            self.bombarded_co[piece_color] = self.get_bombarded_squares(piece_color)

        if is_infantry(piece_type):
            self.adjacent_infantry_squares_co[piece_color] = self.get_adjacent_infantry_squares(piece_color)

        return piece_type

    def _set_piece_at(self, square: Square, piece_type: PieceType, color: Color, orientation: Optional[Orientation] = None) -> None:
        self._remove_piece_at(square)

        mask = BB_SQUARES[square]

        if piece_type == INFANTRY:
            self.infantry |= mask
        elif piece_type == ARMORED_INFANTRY:
            self.armored_infantry |= mask
        elif piece_type == AIRBORNE_INFANTRY:
            self.airborne_infantry |= mask
        elif piece_type == ARTILLERY:
            self.artillery |= mask
        elif piece_type == ARMORED_ARTILLERY:
            self.armored_artillery |= mask
        elif piece_type == HEAVY_ARTILLERY:
            self.heavy_artillery |= mask
        elif piece_type == HQ:
            self.hq |= mask
        else:
            return

        self.occupied ^= mask
        self.occupied_co[color] ^= mask

        self.set_orientation(square, orientation)

        if is_artillery(piece_type):
            self.bombarded_co[color] = self.get_bombarded_squares(color)

        if is_infantry(piece_type):
            self.adjacent_infantry_squares_co[color] = self.get_adjacent_infantry_squares(color)

    def set_piece_at(self, square: Square, piece: Optional[Piece]) -> None:
        if piece is None:
            self._remove_piece_at(square)
        else:
            self._set_piece_at(square, piece.piece_type, piece.color, piece.orientation)

    def _set_board_fen(self, fen: str) -> None:
        self._clear_board()

        parts = fen.split()
        if len(parts) < 3:
            raise ValueError("Invalid FEN string: must have at least four parts (board, red reserve, blue reserve, turn, moves)")

        board_fen, red_reserve_fen, blue_reserve_fen = parts[:3]
        turn_fen = parts[3] if len(parts) > 3 else "r"

        # Set turn
        if turn_fen == "r":
            self.turn = RED
        elif turn_fen == "b":
            self.turn = BLUE
        else:
            raise ValueError("Invalid turn in FEN string: must be 'r' or 'b'")

        ranks = board_fen.split("/")
        for rank_index, rank in enumerate(ranks):
            file_index = 0
            i = 0
            while i < len(rank):
                c = rank[i]
                if c in "12345678":
                    file_index += int(c)
                    i += 1
                else:
                    if i + 1 < len(rank) and rank[i + 1] in CARDINAL_DIRECTIONS:
                        piece = Piece.from_symbol(c + rank[i + 1])
                        i += 2
                    else:
                        piece = Piece.from_symbol(c)
                        i += 1
                    square_index = square(file_index, 7 - rank_index)
                    self.set_piece_at(square_index, piece)
                    file_index += 1

        self.reserves[RED] = ReserveFleet.from_fen(red_reserve_fen if red_reserve_fen != "-" else "")
        self.reserves[BLUE] = ReserveFleet.from_fen(blue_reserve_fen if blue_reserve_fen != "-" else "")

        # HACK: generate free captures to set up the internal board state
        self._clear_free_captures()
        list(self._generate_free_captures(self.turn))

    def board_fen(self) -> str:
        builder = []
        empty = 0

        for square in SQUARES_180:
            piece = self.piece_at(square)

            if not piece:
                empty += 1
            else:
                if empty:
                    builder.append(str(empty))
                    empty = 0
                builder.append(piece.symbol())

            if BB_SQUARES[square] & BB_FILE_H:
                if empty:
                    builder.append(str(empty))
                    empty = 0

                if square != H1:
                    builder.append("/")

        red_reserve = self.reserves[RED].to_fen(RED)
        blue_reserve = self.reserves[BLUE].to_fen(BLUE)
        turn_fen = "r" if self.turn == RED else "b"

        return f"{''.join(builder)} {red_reserve or '-'} {blue_reserve or '-'} {turn_fen}"

    def get_reserve_count(self, piece_type: PieceType, color: Color) -> int:
        return self.reserves[color].get_count(piece_type)

    def add_to_reserve(self, piece_type: PieceType, color: Color, count: int = 1) -> None:
        self.reserves[color].add(piece_type, count)

    def remove_from_reserve(self, piece_type: PieceType, color: Color, count: int = 1) -> None:
        self.reserves[color].remove(piece_type, count)

    def _transposition_key(self) -> Hashable:
        return (self.infantry, self.armored_infantry, self.airborne_infantry,
                self.artillery, self.armored_artillery, self.heavy_artillery,
                self.hq, self.occupied_co[RED], self.occupied_co[BLUE],
                self.turn, self.turn_pieces,
                self.orientation_bit0, self.orientation_bit1, self.orientation_bit2)

    def __repr__(self) -> str:
        return f"BaseBoard('{self.board_fen()}')"

    def __str__(self) -> str:
        builder: List[str] = []

        blue_reserve = self.reserves[BLUE].to_fen(BLUE)
        builder.append(f"{blue_reserve or '-'}\n")

        for square in SQUARES_180:
            piece = self.piece_at(square)

            if piece:
                symbol = piece.symbol()
                if len(symbol) == 1:
                    builder.append(symbol + " ")
                else:
                    builder.append(symbol)
            else:
                builder.append("· ")

            if BB_SQUARES[square] & BB_FILE_H:
                if square != H1:
                    builder.append("\n")
            else:
                builder.append(" ")

        red_reserve = self.reserves[RED].to_fen(RED)
        builder.append(f"\n{red_reserve or '-'}")

        return "".join(builder)

    def unicode(self, *, invert_color: bool = False, borders: bool = False, empty_square: str = "·", orientation: Color = RED) -> str:
        """
        Returns a string representation of the board with Unicode pieces.
        Useful for pretty-printing to a terminal.

        :param invert_color: Invert color of the Unicode pieces.
        :param borders: Show borders and a coordinate margin.
        """
        builder: List[str] = []
        for rank_index in (range(7, -1, -1) if orientation else range(8)):
            if borders:
                builder.append("  ")
                builder.append("-" * 17)
                builder.append("\n")

                builder.append(RANK_NAMES[rank_index])
                builder.append(" ")

            for i, file_index in enumerate(range(8) if orientation else range(7, -1, -1)):
                square_index = square(file_index, rank_index)

                if borders:
                    builder.append("|")
                elif i > 0:
                    builder.append(" ")

                piece = self.piece_at(square_index)

                if piece:
                    builder.append(piece.unicode_symbol(invert_color=invert_color))
                else:
                    builder.append(empty_square)

            if borders:
                builder.append("|")

            if borders or (rank_index > 0 if orientation else rank_index < 7):
                builder.append("\n")

        if borders:
            builder.append("  ")
            builder.append("-" * 17)
            builder.append("\n")
            letters = "a b c d e f g h" if orientation else "h g f e d c b a"
            builder.append("   " + letters)

        return "".join(builder)

    def apply_transform(self, f: Callable[[Bitboard], Bitboard]) -> None:
        self.infantry = f(self.infantry)
        self.armored_infantry = f(self.armored_infantry)
        self.airborne_infantry = f(self.airborne_infantry)
        self.artillery = f(self.artillery)
        self.armored_artillery = f(self.armored_artillery)
        self.heavy_artillery = f(self.heavy_artillery)
        self.hq = f(self.hq)

        self.occupied_co[RED] = f(self.occupied_co[RED])
        self.occupied_co[BLUE] = f(self.occupied_co[BLUE])
        self.bombarded_co[RED] = f(self.bombarded_co[RED])
        self.bombarded_co[BLUE] = f(self.bombarded_co[BLUE])
        self.adjacent_infantry_squares_co[RED] = f(self.adjacent_infantry_squares_co[RED])
        self.adjacent_infantry_squares_co[BLUE] = f(self.adjacent_infantry_squares_co[BLUE])
        self.occupied = f(self.occupied)

        self.orientation_bit0 = f(self.orientation_bit0)
        self.orientation_bit1 = f(self.orientation_bit1)
        self.orientation_bit2 = f(self.orientation_bit2)

    def apply_orientation_transform(self, f: Callable[[int, int, int], Tuple[int, int, int]]) -> None:
        # Get all pieces that have an orientation
        pieces_with_orientation = self.occupied & (self.artillery | self.armored_artillery | self.heavy_artillery)

        # For each piece, extract its orientation bits and apply the transform
        # We can do this by masking each bitboard with the pieces that have orientation
        bit0 = self.orientation_bit0 & pieces_with_orientation
        bit1 = self.orientation_bit1 & pieces_with_orientation
        bit2 = self.orientation_bit2 & pieces_with_orientation

        # Apply the transform to each bit
        self.orientation_bit0, self.orientation_bit1, self.orientation_bit2 = f(bit0, bit1, bit2)

    def transform(self, f: Callable[[Bitboard], Bitboard]) -> "BaseBoard":
        """
        Returns a transformed copy of the board (without move stack)
        by applying a bitboard transformation function.

        Available transformations include :func:`flip_vertical()`,
        :func:`flip_horizontal()`, :func:`flip_diagonal()`,
        :func:`flip_anti_diagonal()`, :func:`shift_down()`,
        :func:`shift_up()`, :func:`shift_left()`, and
        :func:`shift_right()`.

        Alternatively, :func:`~BaseBoard.apply_transform()` can be used
        to apply the transformation on the board.
        """
        board = self.copy()
        board.apply_transform(f)
        return board

    def apply_mirror(self) -> None:
        self.apply_transform(flip_vertical)
        self.apply_transform(flip_horizontal)
        self.apply_orientation_transform(rotate_orientations_180)
        self.reserves[RED], self.reserves[BLUE] = self.reserves[BLUE], self.reserves[RED]
        self.occupied_co[RED], self.occupied_co[BLUE] = self.occupied_co[BLUE], self.occupied_co[RED]
        self.bombarded_co[RED], self.bombarded_co[BLUE] = self.bombarded_co[BLUE], self.bombarded_co[RED]
        self.adjacent_infantry_squares_co[RED], self.adjacent_infantry_squares_co[BLUE] = self.adjacent_infantry_squares_co[BLUE], self.adjacent_infantry_squares_co[RED]
        self.turn = not self.turn

    def mirror(self) -> "BaseBoard":
        """
        Returns a mirrored copy of the board (without move stack).

        The board is mirrored vertically and piece colors are swapped, so that
        the position is equivalent modulo color.

        Alternatively, :func:`~BaseBoard.apply_mirror()` can be used
        to mirror the board.
        """
        board = self.copy()
        board.apply_mirror()
        return board

    def rotate_90_clockwise(self) -> "BaseBoard":
        board = self.copy()
        board.apply_transform(rotate_90_clockwise)
        board.apply_orientation_transform(rotate_orientations_90)
        return board

    def copy(self) -> "BaseBoard":
        board = type(self)(skip_init=True)
        board.occupied_co = self.occupied_co.copy()
        board.reserves = [self.reserves[RED].copy(), self.reserves[BLUE].copy()]
        board.turn = self.turn
        board.turn_pieces = self.turn_pieces
        board.turn_moves = self.turn_moves
        board.did_offer_draw = self.did_offer_draw
        board.did_accept_draw = self.did_accept_draw
        board.turn_auto_moves = self.turn_auto_moves
        board.move_stack = self.move_stack.copy()
        board.infantry = self.infantry
        board.armored_infantry = self.armored_infantry
        board.airborne_infantry = self.airborne_infantry
        board.artillery = self.artillery
        board.armored_artillery = self.armored_artillery
        board.heavy_artillery = self.heavy_artillery
        board.hq = self.hq
        board.occupied = self.occupied
        board.orientation_bit0 = self.orientation_bit0
        board.orientation_bit1 = self.orientation_bit1
        board.orientation_bit2 = self.orientation_bit2
        board.bombarded_co = self.bombarded_co.copy()
        board.adjacent_infantry_squares_co = self.adjacent_infantry_squares_co.copy()
        board.free_capture_clusters = self.free_capture_clusters
        board.free_capture_enemies = self.free_capture_enemies
        board.free_capture_num_allowed = self.free_capture_num_allowed
        return board

    def get_orientation(self, square: Square) -> Optional[Orientation]:
        """Get the orientation of a piece at a given square."""
        mask = BB_SQUARES[square]
        if not self.occupied & mask:
            return None

        # Extract the 3 orientation bits
        bit0 = bool(self.orientation_bit0 & mask)
        bit1 = bool(self.orientation_bit1 & mask)
        bit2 = bool(self.orientation_bit2 & mask)

        # Combine bits into orientation value (0-7)
        return bits_to_orientation(bit0, bit1, bit2)

    def get_bombardment_target(self, artillery_square: Square, orientation: Orientation, n_squares = 2) -> Optional[Square]:
        """Get the target square for artillery bombardment based on current square and orientation.
        Returns None if the target square would be off the board."""
        file = square_file(artillery_square)
        rank = square_rank(artillery_square)
        squares = n_squares

        def clamp_to_board(value: int) -> int:
            return max(0, min(7, value))

        # If it's cardinal directions, we can just clamp the target file or rank
        if orientation == ORIENT_N:  # North
            return square(file, clamp_to_board(rank + squares))
        elif orientation == ORIENT_E:  # East
            return square(clamp_to_board(file + squares), rank)
        elif orientation == ORIENT_S:  # South
            return square(file, clamp_to_board(rank - squares))
        elif orientation == ORIENT_W:  # West
            return square(clamp_to_board(file - squares), rank)

        # If it's diagonal directions, we need to work our way back from the target square
        # TODO(tyler): we could probably have some precomputed lookup table for this
        def find_valid_diagonal(file_delta: int, rank_delta: int, squares: int) -> Optional[Tuple[int, int]]:
            target_file, target_rank = file + squares * file_delta, rank + squares * rank_delta
            while (target_file < 0 or target_file > 7 or target_rank < 0 or target_rank > 7) and squares > 0:
                squares -= 1
                target_file, target_rank = file + squares * file_delta, rank + squares * rank_delta
            return None if squares == 0 else (target_file, target_rank)

        if orientation == ORIENT_NE:  # Northeast
            result = find_valid_diagonal(1, 1, squares)
        elif orientation == ORIENT_SE:  # Southeast
            result = find_valid_diagonal(1, -1, squares)
        elif orientation == ORIENT_SW:  # Southwest
            result = find_valid_diagonal(-1, -1, squares)
        else:  # Northwest
            result = find_valid_diagonal(-1, 1, squares)

        if result is None:
            return None

        target_file, target_rank = result
        return square(target_file, target_rank)

    def set_orientation(self, square: Square, orientation: Optional[Orientation]) -> None:
        """Set the orientation of a piece at a given square."""
        mask = BB_SQUARES[square] & BB_ALL

        if orientation is None:
            # Clear orientation bits
            self.orientation_bit0 &= ~mask
            self.orientation_bit1 &= ~mask
            self.orientation_bit2 &= ~mask
            return

        # Set individual orientation bits
        if orientation & 1: self.orientation_bit0 |= mask
        if orientation & 2: self.orientation_bit1 |= mask
        if orientation & 4: self.orientation_bit2 |= mask

    def _all_infantry(self) -> Bitboard:
        return self.infantry | self.armored_infantry | self.airborne_infantry

    def _all_artillery(self) -> Bitboard:
        return self.artillery | self.armored_artillery | self.heavy_artillery

    def _get_armored_moves(self, square: Square, is_infantry: bool = True) -> Bitboard:
        moves = BB_ARMORED_MOVES[square]

        # similar to chess: include all queen moves that don't jump over pieces
        impassable_squares = self.occupied # | self.bombarded_co[not self.turn]

        # if this is an armored infantry that is currently adjacent to enemy infantry, we can't move it to a square with adjacent enemy infantry
        if is_infantry and BB_SQUARES[square] & self.adjacent_infantry_squares_co[not self.turn]:
            impassable_squares |= self.adjacent_infantry_squares_co[not self.turn]

        moves &= (BB_RANK_ATTACKS[square][BB_RANK_MASKS[square] & impassable_squares] |
                    BB_DIAG_ATTACKS[square][BB_DIAG_MASKS[square] & impassable_squares] |
                    BB_FILE_ATTACKS[square][BB_FILE_MASKS[square] & impassable_squares])

        return moves

    def infantry_move_mask(self, square: Square) -> Bitboard:
        bb_square = BB_SQUARES[square]

        if bb_square & self.infantry:
            return BB_REGULAR_MOVES[square]
        elif bb_square & self.armored_infantry:
            return self._get_armored_moves(square)
        elif bb_square & self.airborne_infantry:
            is_back_rank = (bb_square & (BB_RANK_1 if self.turn == RED else BB_RANK_8))
            return BB_ALL if is_back_rank else BB_REGULAR_MOVES[square]

        return BB_EMPTY

    def artillery_move_mask(self, square: Square) -> Bitboard:
        bb_square = BB_SQUARES[square]

        if bb_square & self.artillery:
            return BB_REGULAR_MOVES[square]
        elif bb_square & self.armored_artillery:
            return self._get_armored_moves(square, is_infantry=False)
        elif self.heavy_artillery & bb_square:
            return BB_REGULAR_MOVES[square]

        return BB_EMPTY

    def get_bombarded_squares(self, color: Color) -> Bitboard:
        result = BB_EMPTY
        artillery = (self.artillery | self.heavy_artillery | self.armored_artillery) & self.occupied_co[color]

        for square in scan_reversed(artillery):
            orientation = self.get_orientation(square)
            if orientation is None:
                continue

            n_squares = 3 if self.piece_type_at(square) == HEAVY_ARTILLERY else 2
            target = self.get_bombardment_target(square, orientation, n_squares)
            if target is not None:
                result |= between_inclusive_end(square, target)

        return result

    def get_adjacent_infantry_squares(self, color: Color) -> Bitboard:
        result = BB_EMPTY
        enemy_infantry = self.occupied_co[color] & self._all_infantry()
        for square in scan_reversed(enemy_infantry):
            result |= BB_ADJACENT_SQUARES[square]
        return result

    def generate_legal_moves(self, from_mask: Bitboard = BB_ALL, to_mask: Bitboard = BB_ALL) -> Iterator[Move]:
        our_pieces = self.occupied_co[self.turn] & ~self.turn_pieces

        if self.turn_moves == 0:
            # First look for bombardments, only return those if they exist
            bombardments = list(self._find_bombardment_moves())
            if len(bombardments) > 0:
                yield from bombardments
                return

            # Then look for all free captures, only return those if they exist
            free_captures = list(set(self._generate_free_captures(self.turn)))
            if len(free_captures) > 0:
                yield from free_captures
                return

        # Get all unoccupied squares and non-bombarded squares
        bombarded = self.bombarded_co[not self.turn]
        squares_with_adjacent_enemy_infantry = self.adjacent_infantry_squares_co[not self.turn]
        unoccupied = ~self.occupied & ~bombarded & to_mask

        # add reserve moves
        back_rank = (BB_RANK_1 if self.turn == RED else BB_RANK_8) & unoccupied
        for piece_type, _ in self.reserves[self.turn]:
            for to_square in scan_forward(back_rank):
                move = Move.reinforce(piece_type, to_square)
                yield move
                if is_infantry(piece_type):
                    captures = self._generate_captures(move)
                    for capture in captures:
                        yield capture

        # hq moves
        hq = our_pieces & self.hq & from_mask
        for from_square in scan_reversed(hq):
            moves = BB_REGULAR_MOVES[from_square] & unoccupied & to_mask
            for to_square in scan_reversed(moves):
                yield Move.move(from_square, to_square)

        # infantry
        non_artillery = our_pieces & self._all_infantry() & from_mask
        for from_square in scan_reversed(non_artillery):

            # if the infantry piece is on a square with adjacent enemy infantry, we can't move it to a square with adjacent enemy infantry
            allowed_infantry_squares = unoccupied
            if BB_SQUARES[from_square] & squares_with_adjacent_enemy_infantry:
                # only mask the immdiately adjacent squares, since an armored can disengage and re-engage
                if is_armored(self.piece_type_at(from_square)):
                    allowed_infantry_squares &= ~(BB_REGULAR_MOVES[from_square] & squares_with_adjacent_enemy_infantry)
                else:
                    allowed_infantry_squares &= ~squares_with_adjacent_enemy_infantry

            moves = self.infantry_move_mask(from_square) & allowed_infantry_squares & to_mask
            for to_square in scan_reversed(moves):
                move = Move.move(from_square, to_square)
                yield move
                captures = self._generate_captures(move)
                for capture in captures:
                    yield capture

        # artillery moves
        artillery = (self.artillery | self.heavy_artillery | self.armored_artillery) & our_pieces & from_mask
        for from_square in scan_reversed(artillery):
            # artillery can stay in place and rotate in any direction except their previous orientation
            previous_orientation = self.get_orientation(from_square)
            for orientation in range(8):
                if orientation == previous_orientation:
                    continue
                yield Move.move_and_orient(from_square, from_square, orientation)

            # artillery can move and rotate in any direction
            moves = self.artillery_move_mask(from_square) & unoccupied & to_mask
            for to_square in scan_reversed(moves):
                for orientation in range(8):
                    yield Move.move_and_orient(from_square, to_square, orientation)

        # users can always skip
        yield Move.skip()

    def generate_legal_captures(self, from_mask: Bitboard = BB_ALL, to_mask: Bitboard = BB_ALL) -> Iterator[Move]:
        our_artillery = self.occupied_co[self.turn] & self._all_artillery()
        return self.generate_legal_moves(from_mask & ~our_artillery, to_mask)

    def _generate_captures(self, move: Move) -> Iterator[Move]:
        color = self.turn
        free_capture_clusters, free_capture_enemies, free_capture_num_allowed = self._find_free_captures(color, move)

        if free_capture_clusters == BB_EMPTY and free_capture_enemies == BB_EMPTY and free_capture_num_allowed == BB_EMPTY:
            return

        hq_attacker_count = 0

        for cluster in find_clusters(free_capture_clusters):
            num_allowed = popcount(free_capture_num_allowed & cluster)
            if num_allowed == 0:
                continue

            # skip if we're not moving into this cluster
            if move.to_square is None or not (cluster & BB_SQUARES[move.to_square]):
                continue

            capturable_enemies = free_capture_enemies & cluster & self.occupied_co[not color]
            for square in scan_reversed(capturable_enemies):
                # skip if the enemy is not adjacent to the move's to square
                if not (BB_ADJACENT_SQUARES[move.to_square] & BB_SQUARES[square]):
                    continue

                if self.piece_type_at(square) == HQ:
                    hq_attacker_count += 1 if num_allowed == 1 else 2
                    if hq_attacker_count > 1:
                        yield move.with_capture(square)
                else:
                    yield move.with_capture(square)

    def _find_adjacent_attackable_squares(self, engaged: Tuple[Bitboard, Bitboard], attacker_from: Square | None, attacker_to: Square) -> Bitboard:
        attacker_color = self.color_at(attacker_to)
        adjacent_squares_with_enamies = BB_ADJACENT_SQUARES[attacker_to] & self.occupied_co[not attacker_color]

        # artillery or engaged pieces
        artillery = self.artillery | self.heavy_artillery | self.armored_artillery
        engaged_or_artillery = self.occupied_co[not self.turn] & (engaged[not self.turn] | artillery)
        single_captures = BB_ADJACENT_SQUARES[attacker_to] & engaged_or_artillery

        # hq captures
        enemy_hq_bb = self.hq & self.occupied_co[not self.turn]
        enemy_hq = msb(enemy_hq_bb) if enemy_hq_bb else None
        if enemy_hq is None:
            return single_captures

        our_infantry = self._all_infantry() & self.occupied_co[self.turn]
        if attacker_from is not None:
            our_infantry &= ~BB_SQUARES[attacker_from]
        our_infantry |= BB_SQUARES[attacker_to]
        adjacent_infantry = BB_ADJACENT_SQUARES[enemy_hq] & our_infantry
        unengaged_infantry = adjacent_infantry & ~engaged[self.turn]
        capturable_hq = popcount(unengaged_infantry) >= 2
        hq_capture = BB_SQUARES[enemy_hq] if capturable_hq else BB_EMPTY

        return adjacent_squares_with_enamies & (single_captures | hq_capture)

    def maximize_engagement(
        self,
        attacker_from: Square | None,
        attacker_to: Square | None,
    ) -> Tuple[Bitboard, Bitboard]:
        def in_bounds(sq: int, direction: int) -> bool:
            if direction == -1: return sq % 8 > 0
            if direction == 1: return sq % 8 < 7
            return 0 <= sq + direction <= 63

        def iter_bits(bitboard: int) -> List[int]:
            # Yields positions of all set bits
            bits = []
            while bitboard:
                lsb = bitboard & -bitboard
                sq = (lsb - 1).bit_length()
                bits.append(sq)
                bitboard ^= lsb
            return bits

        attacker_infantry = self.occupied_co[self.turn] & self.infantry
        defender_infantry = self.occupied_co[not self.turn] & self.infantry

        if attacker_from is not None:
            attacker_infantry &= ~BB_SQUARES[attacker_from]
        if attacker_to is not None:
            attacker_infantry |= BB_SQUARES[attacker_to]

        attackers = iter_bits(attacker_infantry)
        defenders = iter_bits(defender_infantry)

        # Ensure attacker_to is last (lowest priority)
        if attacker_to in attackers:
            attackers.remove(attacker_to)
            attackers.append(attacker_to)

        # attacker_index = {sq: i for i, sq in enumerate(attackers)}
        defender_index = {sq: i for i, sq in enumerate(defenders)}

        adj_list = [[] for _ in range(len(attackers))]

        # Build adjacency (engagement) graph
        for a_idx, a_sq in enumerate(attackers):
            for d in [-1, 1, -8, 8]:
                if in_bounds(a_sq, d):
                    neighbor = a_sq + d
                    if neighbor in defender_index:
                        d_idx = defender_index[neighbor]
                        if neighbor == attacker_to:
                            adj_list[a_idx].append(d_idx)
                        else:
                            adj_list[a_idx].insert(0, d_idx)

        # DFS-based bipartite matching
        match_to_defender = [-1] * len(defenders)

        def bpm(u: int, visited: List[bool]) -> bool:
            for v in adj_list[u]:
                if not visited[v]:
                    visited[v] = True
                    if match_to_defender[v] == -1 or bpm(match_to_defender[v], visited):
                        match_to_defender[v] = u
                        return True
            return False

        for u in range(len(attackers)):
            visited = [False] * len(defenders)
            bpm(u, visited)

        red_engaged: Bitboard = BB_EMPTY
        blue_engaged: Bitboard = BB_EMPTY

        for d_idx, a_idx in enumerate(match_to_defender):
            if a_idx != -1:
                if self.turn == RED:
                    red_engaged |= BB_SQUARES[attackers[a_idx]]
                    blue_engaged |= BB_SQUARES[defenders[d_idx]]
                else:
                    red_engaged |= BB_SQUARES[defenders[d_idx]]
                    blue_engaged |= BB_SQUARES[attackers[a_idx]]

        return red_engaged, blue_engaged

    def push(self, move: Move) -> None:
        """
        Updates the position with the given *move* and puts it onto the
        move stack.

        TODO(tyler): add board state to board state stack
        """
        self.move_stack.append(move)

        # Move pieces from one square to the next
        if move.name == "Move":
            self._move_piece(move)
            self._do_captures(move)
            self.did_offer_draw = False
        elif move.name == "MoveAndOrient":
            self._move_piece(move)
            self.did_offer_draw = False
        elif move.name == "Reinforce":
            if move.unit_type is None:
                raise ValueError(f"invalid reinforce move: {move}")
            if move.to_square is None:
                raise ValueError(f"invalid reinforce move: {move}")

            orientation = ORIENT_N if self.turn == RED else ORIENT_S
            self.reserves[self.turn].remove(move.unit_type)
            self._set_piece_at(move.to_square, move.unit_type, self.turn, orientation)
            self._do_captures(move)
            self.did_offer_draw = False
        elif move.name == "Skip":
            if self.did_offer_draw:
                self.did_accept_draw = True
            else:
                self.did_offer_draw = self.turn_moves == 0
        elif move.name == "AutoCapture":
            if move.auto_capture_type == "free":
                self._do_captures(move)
                self._record_free_capture(move)
            elif move.auto_capture_type == "bombard":
                self._do_captures(move)

            self.turn_auto_moves += 1
            return

        # Increment turn moves.
        self.turn_moves += 1

        # Mark this piece as moved so we can't move it again this turn
        if move.to_square is not None:
            self.turn_pieces |= BB_SQUARES[move.to_square]

        # Swap turn.
        if self.turn_moves == 3 or move.name == "Skip":
            self.turn = not self.turn
            self.turn_moves = 0
            self.turn_auto_moves = 0
            self.turn_pieces = BB_EMPTY
            self.end_of_turn_occupied_enemy_infantry = self.occupied_co[not self.turn] & self.infantry

            # HACK: generate free captures to set up the internal board state
            self._clear_free_captures()
            list(self._generate_free_captures(self.turn))

    def _move_piece(self, move: Move) -> None:
        if move.from_square is None:
            raise ValueError(f"invalid move: {move}")
        if move.to_square is None:
            raise ValueError(f"invalid move: {move}")

        piece_type = self._remove_piece_at(move.from_square)
        assert piece_type is not None, f"push() expects move to be pseudo-legal, but got {move} in {self.board_fen()}"
        self._set_piece_at(move.to_square, piece_type, self.turn, move.orientation)

    def _do_captures(self, move: Move) -> None:
        if move.capture_preference is not None:
            self._remove_piece_at(move.capture_preference)

    def _find_bombardment_moves(self) -> Iterator[Move]:
        bombarded_squares = self.bombarded_co[self.turn]
        enemy_pieces = self.occupied_co[not self.turn] & bombarded_squares

        for square in scan_reversed(enemy_pieces):
            yield Move.auto_capture_bombard(square)

    def _remove_bombarded_pieces(self) -> None:
        for move in self._find_bombardment_moves():
            if move.capture_preference is None:
                raise ValueError(f"invalid bombardment move: {move}")

            self.move_stack.append(move)
            self._remove_piece_at(move.capture_preference)

    def _record_free_capture(self, move: Move) -> None:
        if move.auto_capture_type != "free" or move.capture_preference is None:
            raise ValueError(f"invalid free capture: {move}")

        capture_square = move.capture_preference

        for cluster in find_clusters(self.free_capture_clusters):
            if cluster & BB_SQUARES[capture_square]:
                msb_pos = msb(self.free_capture_num_allowed & cluster) # remove one from this cluster of allowed captures
                self.free_capture_num_allowed &= ~BB_SQUARES[msb_pos]
                break

    def _clear_free_captures(self) -> None:
        self.free_capture_clusters = BB_EMPTY
        self.free_capture_enemies = BB_EMPTY
        self.free_capture_num_allowed = BB_EMPTY

    def _generate_free_captures(self, color: Color):
        if self.turn_moves != 0:
            return

        if self.free_capture_clusters == BB_EMPTY and self.free_capture_enemies == BB_EMPTY and self.free_capture_num_allowed == BB_EMPTY:
            free_capture_clusters, free_capture_enemies, free_capture_num_allowed = self._find_free_captures(color)
            self.free_capture_clusters = free_capture_clusters
            self.free_capture_enemies = free_capture_enemies
            self.free_capture_num_allowed = free_capture_num_allowed

        if self.free_capture_clusters == BB_EMPTY and self.free_capture_enemies == BB_EMPTY and self.free_capture_num_allowed == BB_EMPTY:
            return

        hq_attacker_count = 0

        for cluster in find_clusters(self.free_capture_clusters):
            num_allowed = popcount(self.free_capture_num_allowed & cluster)
            if num_allowed == 0:
                continue

            capturable_enemies = self.free_capture_enemies & cluster & self.occupied_co[not color]
            for square in scan_reversed(capturable_enemies):
                if self.piece_type_at(square) == HQ:
                    hq_attacker_count += 1 if num_allowed == 1 else 2
                    if hq_attacker_count > 1:
                        yield Move.auto_capture_free(square)
                else:
                    yield Move.auto_capture_free(square)

    def _find_free_captures(self, color: Color, move: Optional[Move] = None):
        free_capture_clusters = BB_EMPTY
        free_capture_enemies = BB_EMPTY
        free_capture_num_allowed = BB_EMPTY

        all_units = self._all_infantry()
        occupied_co = self.occupied_co.copy()

        if move is not None:
            if move.to_square is None:
                raise ValueError(f"invalid free capture move: {move}")
            to_square = move.to_square

            # short circuit if the to_square isn't adjacent to any enemy pieces
            if not (BB_ADJACENT_SQUARES[to_square] & occupied_co[not color]):
                return BB_EMPTY, BB_EMPTY, BB_EMPTY

            if move.name != "Move" and move.name != "Reinforce":
                # short circuit if we're not making a move
                return BB_EMPTY, BB_EMPTY, BB_EMPTY
            if move.name == "Move":
                if move.from_square is None:
                    raise ValueError(f"invalid free capture move: {move}")
                # remove the piece from its original square square
                all_units &= ~BB_SQUARES[move.from_square]
                occupied_co[color] &= ~BB_SQUARES[move.from_square]

            all_units |= BB_SQUARES[to_square]
            occupied_co[color] |= BB_SQUARES[to_square]


        for cluster in self._find_adjacency_clusters(occupied_co, all_units):
            [enemies, num_allowed] = self._find_free_captures_for_cluster(occupied_co, cluster, color)
            if enemies == BB_EMPTY:
                continue

            free_capture_clusters |= cluster | enemies
            free_capture_enemies |= enemies
            free_capture_num_allowed |= num_allowed

        return free_capture_clusters, free_capture_enemies, free_capture_num_allowed

    def _find_free_captures_for_cluster(self, occupied_co: List[Bitboard], cluster: Bitboard, color: Color):
        our_infantry = cluster & occupied_co[color]
        enemy_infantry = cluster & occupied_co[not color]

        num_our_infantry = popcount(our_infantry)
        num_enemy_infantry = popcount(enemy_infantry)

        num_capturable_enemies = max(num_our_infantry - num_enemy_infantry, 0)

        # if we have equal or less infantry than the enemy, we can't free capture
        if num_capturable_enemies == 0:
            return [BB_EMPTY, BB_EMPTY]

        capturable_enemies = BB_EMPTY
        for square in scan_reversed(our_infantry):
            all_enemies_adjacent_to_ours = BB_ADJACENT_SQUARES[square] & occupied_co[not color]
            for enemy in scan_reversed(all_enemies_adjacent_to_ours):
                if not self._is_artillery_pointed_at(enemy, square):
                    capturable_enemies |= BB_SQUARES[enemy]

        num_captures_board = msb_n(our_infantry, num_capturable_enemies)

        return [capturable_enemies, num_captures_board]

    def _find_adjacency_clusters(self, occupied_co: List[Bitboard], all_units: Bitboard):
        visited = BB_EMPTY

        while all_units:
            # Find the first unvisited unit (lowest bit)
            start = all_units & -all_units
            if not start:
                break

            # Get color of starting unit
            start_color = self.color_at(lsb(start), occupied_co)
            if start_color is None:
                continue

            # Initialize cluster with this unit
            cluster = start
            frontier = start
            visited |= start
            current_color = start_color

            # Flood fill
            while frontier:
                # Get all adjacent squares to current frontier
                adjacent = BB_EMPTY
                for square in scan_reversed(frontier):
                    # Expand to squares of opposite color
                    adjacent |= BB_ADJACENT_SQUARES[square] & occupied_co[not current_color]

                # Find new units to add to cluster
                new_units = adjacent & all_units & ~visited
                cluster |= new_units
                visited |= new_units
                frontier = new_units

                # Flip color for next iteration
                current_color = not current_color

            yield cluster
            all_units &= ~visited

    def is_legal(self, move: Move) -> bool:
        return move in self.generate_legal_moves()

    def is_game_over(self) -> bool:
        return self.outcome() is not None

    def outcome(self) -> Optional[Outcome]:
        if self._is_hq_captured(RED):
            return Outcome("hq capture", BLUE)
        if self._is_hq_captured(BLUE):
            return Outcome("hq capture", RED)
        if self.turn_moves == 0 and not any(self.generate_legal_moves()):
            if self._is_hq_under_bombardment(self.turn):
                return Outcome("hq capture", not self.turn)
            return Outcome("stalemate", None)
        if self.did_offer_draw and self.did_accept_draw:
            return Outcome("double skip", None)

        return None

    def _is_hq_captured(self, color: Color) -> bool:
        return popcount(self.hq & self.occupied_co[color]) == 0

    def _is_hq_under_bombardment(self, color: Color) -> bool:
        return popcount(self.hq & self.occupied_co[color] & self.bombarded_co[not color]) > 0

    def _is_artillery_pointed_at(self, artillery: Square, target_square: Square) -> bool:
        piece_type = self.piece_type_at(artillery)
        if piece_type is None or not is_artillery(piece_type):
            return False
        orientation = self.get_orientation(artillery)
        if orientation is None:
            return False

        if orientation == ORIENT_N:
            return artillery + 8 == target_square
        if orientation == ORIENT_S:
            return artillery - 8 == target_square
        if orientation == ORIENT_E:
            return artillery + 1 == target_square
        if orientation == ORIENT_W:
            return artillery - 1 == target_square

        return False


IntoSquareSet: TypeAlias = Union[SupportsInt, Iterable[Square]]

class SquareSet:
    """
    A set of squares.

    >>> squares = SquareSet([A8, A1])
    >>> squares
    SquareSet(0x0100_0000_0000_0001)

    >>> squares = SquareSet(BB_A8 | BB_RANK_1)
    >>> squares
    SquareSet(0x0100_0000_0000_00ff)

    >>> print(squares)
    1 . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    1 1 1 1 1 1 1 1

    >>> len(squares)
    9

    >>> bool(squares)
    True

    >>> B1 in squares
    True

    >>> for square in squares:
    ...     # 0 -- A1
    ...     # 1 -- B1
    ...     # 2 -- C1
    ...     # 3 -- D1
    ...     # 4 -- E1
    ...     # 5 -- F1
    ...     # 6 -- G1
    ...     # 7 -- H1
    ...     # 56 -- A8
    ...     print(square)
    ...
    0
    1
    2
    3
    4
    5
    6
    7
    56

    >>> list(squares)
    [0, 1, 2, 3, 4, 5, 6, 7, 56]

    Square sets are internally represented by 64-bit integer masks of the
    included squares. Bitwise operations can be used to compute unions,
    intersections and shifts.

    >>> int(squares)
    72057594037928191

    Also supports common set operations like
    :func:`~SquareSet.issubset()`, :func:`~SquareSet.issuperset()`,
    :func:`~SquareSet.union()`, :func:`~SquareSet.intersection()`,
    :func:`~SquareSet.difference()`,
    :func:`~SquareSet.symmetric_difference()` and
    :func:`~SquareSet.copy()` as well as
    :func:`~SquareSet.update()`,
    :func:`~SquareSet.intersection_update()`,
    :func:`~SquareSet.difference_update()`,
    :func:`~SquareSet.symmetric_difference_update()` and
    :func:`~SquareSet.clear()`.
    """

    def __init__(self, squares: IntoSquareSet = BB_EMPTY) -> None:
        try:
            self.mask: Bitboard = squares.__int__() & BB_ALL  # type: ignore
            return
        except AttributeError:
            self.mask = 0

        # Try squares as an iterable. Not under except clause for nicer
        # backtraces.
        for square in squares:  # type: ignore
            self.add(square)

    # Set

    def __contains__(self, square: Square) -> bool:
        return bool(BB_SQUARES[square] & self.mask)

    def __iter__(self) -> Iterator[Square]:
        return scan_forward(self.mask)

    def __reversed__(self) -> Iterator[Square]:
        return scan_reversed(self.mask)

    def __len__(self) -> int:
        return popcount(self.mask)

    # MutableSet

    def add(self, square: Square) -> None:
        """Adds a square to the set."""
        self.mask |= BB_SQUARES[square]

    def discard(self, square: Square) -> None:
        """Discards a square from the set."""
        self.mask &= ~BB_SQUARES[square]

    # frozenset

    def isdisjoint(self, other: IntoSquareSet) -> bool:
        """Tests if the square sets are disjoint."""
        return not bool(self & other)

    def issubset(self, other: IntoSquareSet) -> bool:
        """Tests if this square set is a subset of another."""
        return not bool(self & ~SquareSet(other))

    def issuperset(self, other: IntoSquareSet) -> bool:
        """Tests if this square set is a superset of another."""
        return not bool(~self & other)

    def union(self, other: IntoSquareSet) -> "SquareSet":
        return self | other

    def __or__(self, other: IntoSquareSet) -> "SquareSet":
        r = SquareSet(other)
        r.mask |= self.mask
        return r

    def intersection(self, other: IntoSquareSet) -> "SquareSet":
        return self & other

    def __and__(self, other: IntoSquareSet) -> "SquareSet":
        r = SquareSet(other)
        r.mask &= self.mask
        return r

    def difference(self, other: IntoSquareSet) -> "SquareSet":
        return self - other

    def __sub__(self, other: IntoSquareSet) -> "SquareSet":
        r = SquareSet(other)
        r.mask = self.mask & ~r.mask
        return r

    def symmetric_difference(self, other: IntoSquareSet) -> "SquareSet":
        return self ^ other

    def __xor__(self, other: IntoSquareSet) -> "SquareSet":
        r = SquareSet(other)
        r.mask ^= self.mask
        return r

    def copy(self) -> "SquareSet":
        return SquareSet(self.mask)

    # set

    def update(self, *others: IntoSquareSet) -> None:
        for other in others:
            self |= other

    def __ior__(self, other: IntoSquareSet) -> "SquareSet":
        self.mask |= SquareSet(other).mask
        return self

    def intersection_update(self, *others: IntoSquareSet) -> None:
        for other in others:
            self &= other

    def __iand__(self, other: IntoSquareSet) -> "SquareSet":
        self.mask &= SquareSet(other).mask
        return self

    def difference_update(self, other: IntoSquareSet) -> None:
        self -= other

    def __isub__(self, other: IntoSquareSet) -> "SquareSet":
        self.mask &= ~SquareSet(other).mask
        return self

    def symmetric_difference_update(self, other: IntoSquareSet) -> None:
        self ^= other

    def __ixor__(self, other: IntoSquareSet) -> "SquareSet":
        self.mask ^= SquareSet(other).mask
        return self

    def remove(self, square: Square) -> None:
        """
        Removes a square from the set.

        :raises: :exc:`KeyError` if the given *square* was not in the set.
        """
        mask = BB_SQUARES[square]
        if self.mask & mask:
            self.mask ^= mask
        else:
            raise KeyError(square)

    def pop(self) -> Square:
        """
        Removes and returns a square from the set.

        :raises: :exc:`KeyError` if the set is empty.
        """
        if not self.mask:
            raise KeyError("pop from empty SquareSet")

        square = lsb(self.mask)
        self.mask &= (self.mask - 1)
        return square

    def clear(self) -> None:
        """Removes all elements from this set."""
        self.mask = BB_EMPTY

    # SquareSet

    def carry_rippler(self) -> Iterator[Bitboard]:
        """Iterator over the subsets of this set."""
        return _carry_rippler(self.mask)

    def mirror(self) -> "SquareSet":
        """Returns a vertically mirrored copy of this square set."""
        return SquareSet(flip_vertical(self.mask))

    def tolist(self) -> List[bool]:
        """Converts the set to a list of 64 bools."""
        result = [False] * 64
        for square in self:
            result[square] = True
        return result

    def __bool__(self) -> bool:
        return bool(self.mask)

    def __eq__(self, other: object) -> bool:
        try:
            return self.mask == SquareSet(other).mask  # type: ignore
        except (TypeError, ValueError):
            return NotImplemented

    def __lshift__(self, shift: int) -> "SquareSet":
        return SquareSet((self.mask << shift) & BB_ALL)

    def __rshift__(self, shift: int) -> "SquareSet":
        return SquareSet(self.mask >> shift)

    def __ilshift__(self, shift: int) -> "SquareSet":
        self.mask = (self.mask << shift) & BB_ALL
        return self

    def __irshift__(self, shift: int) -> "SquareSet":
        self.mask >>= shift
        return self

    def __invert__(self) -> "SquareSet":
        return SquareSet(~self.mask & BB_ALL)

    def __int__(self) -> int:
        return self.mask

    def __index__(self) -> int:
        return self.mask

    def __repr__(self) -> str:
        return f"SquareSet({self.mask:#021_x})"

    def __str__(self) -> str:
        builder: List[str] = []

        for square in SQUARES_180:
            mask = BB_SQUARES[square]
            builder.append("1" if self.mask & mask else ".")

            if not mask & BB_FILE_H:
                builder.append(" ")
            elif square != H1:
                builder.append("\n")

        return "".join(builder)

    @classmethod
    def ray(cls, a: Square, b: Square) -> "SquareSet":
        """
        All squares on the rank, file or diagonal with the two squares, if they
        are aligned.

        >>> print(SquareSet.ray(E2, B5))
        . . . . . . . .
        . . . . . . . .
        1 . . . . . . .
        . 1 . . . . . .
        . . 1 . . . . .
        . . . 1 . . . .
        . . . . 1 . . .
        . . . . . 1 . .
        """
        return cls(ray(a, b))

    @classmethod
    def between(cls, a: Square, b: Square) -> "SquareSet":
        """
        All squares on the rank, file or diagonal between the two squares
        (bounds not included), if they are aligned.

        >>> print(SquareSet.between(E2, B5))
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . 1 . . . . .
        . . . 1 . . . .
        . . . . . . . .
        . . . . . . . .
        """
        return cls(between(a, b))

    @classmethod
    def between_inclusive_end(cls, a: Square, b: Square) -> "SquareSet":
        """
        All squares on the rank, file or diagonal between the two squares
        (bounds included), if they are aligned.

        >>> print(SquareSet.between_inclusive_end(E2, B5))
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . 1 . . . . . .
        . . 1 . . . . .
        . . . 1 . . . .
        . . . . . . . .
        . . . . . . . .
        """
        return cls(between_inclusive_end(a, b))

    @classmethod
    def from_square(cls, square: Square) -> "SquareSet":
        """
        Creates a :class:`~SquareSet` from a single square.

        >>> SquareSet.from_square(A1) == BB_A1
        True
        """
        return cls(BB_SQUARES[square])


def find_clusters(board: Bitboard):
    all_units = board
    visited = BB_EMPTY

    while all_units:
        start = all_units & -all_units
        if not start:
            break

        cluster = start
        frontier = start
        visited |= start

        while frontier:
            adjacent = BB_EMPTY
            for square in scan_reversed(frontier):
                adjacent |= BB_ADJACENT_SQUARES[square] & board

            new_units = adjacent & all_units & ~visited
            cluster |= new_units
            visited |= new_units
            frontier = new_units

        yield cluster
        all_units &= ~visited


import random


class RandomPlayer():
    def __init__(self, board):
        self.board = board

    def get_next_move(self):
        moves = list(self.board.generate_legal_moves())
        return random.choice(moves)


class ValuePlayer():
    def __init__(self, board):
        self.board = board

    def get_next_move(self):
        moves = self.board.generate_legal_moves()
        best_move = None
        best_value = float("-inf")

        for m1 in moves:
            b1 = self.board.copy()
            b1.push(m1)
            v = -1 * evaluate_board_for_blue(b1)
            if v > best_value:
                best_value = v
                best_move = m1

        return best_move


PIECE_VALUES: Dict[PieceType, float] = {
    HQ: 100,
    INFANTRY: 1,
    ARMORED_INFANTRY: 2,
    AIRBORNE_INFANTRY: 4,
    ARTILLERY: 3,
    ARMORED_ARTILLERY: 4,
    HEAVY_ARTILLERY: 5,
}

POSITION_GRADIENT = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.05, 0.07, 0.09, 0.1, 0.1, 0.09, 0.07, 0.05,
    0.15, 0.17, 0.19, 0.2, 0.2, 0.19, 0.17, 0.15,
    0.25, 0.27, 0.29, 0.3, 0.3, 0.29, 0.27, 0.25,
    0.35, 0.37, 0.39, 0.4, 0.4, 0.39, 0.37, 0.35,
    0.45, 0.47, 0.49, 0.5, 0.5, 0.49, 0.47, 0.45,
    0.55, 0.57, 0.59, 0.6, 0.6, 0.59, 0.57, 0.55,
    0.65, 0.67, 0.69, 0.7, 0.7, 0.69, 0.67, 0.65,
    0.75, 0.77, 0.79, 0.8, 0.8, 0.79, 0.77, 0.75,
]

POSITION_GRADIENTS = {
    RED: POSITION_GRADIENT,
    BLUE: POSITION_GRADIENT[::-1],
}

def evaluate_board_for_blue(board: BaseBoard) -> float:
    return _get_color_score(board, RED) - _get_color_score(board, BLUE)

def _get_color_score(board: BaseBoard, color: Color) -> float:
    score = 0

    # switch the turn to trigger bombardments and so we can evaluate captures for red,
    # but not for blue, because we're assuming we're just looking at blue's perspective,
    # and switching it on red's turn would trigger free captures for blue (or something)
    if board.turn == color and color != RED:
        board.push(Move.skip())

    while True:
        moves = board.generate_legal_captures()

        for move in moves:
            if move.capture_preference is not None:
                board.push(move)
                break
        else:
            break

    for piece_type in PIECE_VALUES:
        pieces_mask = board.pieces_mask(piece_type, color)
        for square in scan_reversed(pieces_mask):
            multiplier = 1 if piece_type == ARTILLERY or piece_type == ARMORED_ARTILLERY or piece_type == HEAVY_ARTILLERY else 0.5
            if piece_type == AIRBORNE_INFANTRY:
                multiplier = -3
            if piece_type == HQ:
                multiplier = -0.2
            score += PIECE_VALUES[piece_type] + (POSITION_GRADIENTS[color][square] * multiplier)

    for square in scan_reversed(board.bombarded_co[color]):
        score += POSITION_GRADIENTS[color][square] * 1

    return score
