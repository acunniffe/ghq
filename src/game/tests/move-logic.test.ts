import { describe, expect, it } from "@jest/globals";
import { GHQState } from "@/game/engine";
import { movesForActivePiece } from "@/game/move-logic";

describe("computing allowed moves", () => {
  it("can compute allowed when surronded on all but one side", () => {
    // opening. top of the board, artillery right of the HQ
    const moves = movesForActivePiece([0, 1], initialBoardSetup);
    expect(moves).toMatchInlineSnapshot(`
      [
        [
          0,
          2,
        ],
      ]
    `);
  });

  it("can compute allowed moves when forward squares open", () => {
    // opening. top of the board, middle infantry
    const moves = movesForActivePiece([1, 1], initialBoardSetup);
    expect(moves).toMatchInlineSnapshot(`
      [
        [
          0,
          2,
        ],
        [
          2,
          0,
        ],
        [
          2,
          1,
        ],
        [
          2,
          2,
        ],
      ]
    `);
  });

  it("can compute allowed moves for 2 mobility piece", () => {
    // opening. top of the board, middle infantry
    const moves = movesForActivePiece([0, 7], initialBoardSetupWithAnArmored);
    expect(moves).toMatchInlineSnapshot(`
      [
        [
          0,
          6,
        ],
        [
          0,
          5,
        ],
        [
          1,
          6,
        ],
        [
          2,
          5,
        ],
        [
          1,
          7,
        ],
        [
          2,
          7,
        ],
      ]
    `);
  });

  it("can compute allowed moves for airborne on back", () => {
    // opening. top of the board, middle infantry
    const moves = movesForActivePiece(
      [0, 7],
      initialBoardSetupWithAnAirborneBack
    );
    expect(moves).toMatchInlineSnapshot(`
      [
        [
          0,
          2,
        ],
        [
          0,
          3,
        ],
        [
          0,
          4,
        ],
        [
          0,
          5,
        ],
        [
          0,
          6,
        ],
        [
          1,
          3,
        ],
        [
          1,
          4,
        ],
        [
          1,
          5,
        ],
        [
          1,
          6,
        ],
        [
          1,
          7,
        ],
        [
          2,
          0,
        ],
        [
          2,
          1,
        ],
        [
          2,
          2,
        ],
        [
          2,
          3,
        ],
        [
          2,
          4,
        ],
        [
          2,
          5,
        ],
        [
          2,
          6,
        ],
        [
          2,
          7,
        ],
        [
          3,
          0,
        ],
        [
          3,
          1,
        ],
        [
          3,
          2,
        ],
        [
          3,
          3,
        ],
        [
          3,
          4,
        ],
        [
          3,
          5,
        ],
        [
          3,
          6,
        ],
        [
          3,
          7,
        ],
        [
          4,
          0,
        ],
        [
          4,
          1,
        ],
        [
          4,
          2,
        ],
        [
          4,
          3,
        ],
        [
          4,
          4,
        ],
        [
          4,
          5,
        ],
        [
          4,
          6,
        ],
        [
          4,
          7,
        ],
        [
          5,
          0,
        ],
        [
          5,
          1,
        ],
        [
          5,
          2,
        ],
        [
          5,
          3,
        ],
        [
          5,
          4,
        ],
        [
          5,
          5,
        ],
        [
          5,
          6,
        ],
        [
          5,
          7,
        ],
        [
          6,
          0,
        ],
        [
          6,
          1,
        ],
        [
          6,
          2,
        ],
        [
          6,
          3,
        ],
        [
          6,
          4,
        ],
        [
          7,
          0,
        ],
        [
          7,
          1,
        ],
        [
          7,
          2,
        ],
        [
          7,
          3,
        ],
        [
          7,
          4,
        ],
        [
          7,
          5,
        ],
      ]
    `);
  });
});
it("can compute allowed moves for airborne on not on back", () => {
  // opening. top of the board, middle infantry
  const moves = movesForActivePiece(
    [1, 3],
    initialBoardSetupWithAnAirborneNotBack
  );
  expect(moves).toMatchInlineSnapshot(`
    [
      [
        0,
        2,
      ],
      [
        0,
        3,
      ],
      [
        0,
        4,
      ],
      [
        1,
        4,
      ],
      [
        2,
        2,
      ],
      [
        2,
        3,
      ],
      [
        2,
        4,
      ],
    ]
  `);
});

const initialBoardSetup: GHQState["board"] = [
  [
    { type: "HQ", player: "BLUE" },
    { type: "ARTILLERY", player: "BLUE", orientation: 180 },
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  [
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    null,
    null,
    null,
    null,
    null,
  ],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [
    null,
    null,
    null,
    null,
    null,
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    { type: "ARTILLERY", player: "RED", orientation: 0 },
    { type: "HQ", player: "RED" },
  ],
];

const initialBoardSetupWithAnArmored: GHQState["board"] = [
  [
    { type: "HQ", player: "BLUE" },
    { type: "ARTILLERY", player: "BLUE", orientation: 180 },
    null,
    null,
    null,
    null,
    null,
    { type: "ARMORED_INFANTRY", player: "BLUE", orientation: 180 },
  ],
  [
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    null,
    null,
    null,
    null,
    null,
  ],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [
    null,
    null,
    null,
    null,
    null,
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    { type: "ARTILLERY", player: "RED", orientation: 0 },
    { type: "HQ", player: "RED" },
  ],
];

const initialBoardSetupWithAnAirborneBack: GHQState["board"] = [
  [
    { type: "HQ", player: "BLUE" },
    { type: "ARTILLERY", player: "BLUE", orientation: 180 },
    null,
    null,
    null,
    null,
    null,
    { type: "AIRBORNE_INFANTRY", player: "BLUE" },
  ],
  [
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    null,
    null,
    null,
    null,
    null,
  ],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [
    null,
    null,
    null,
    null,
    null,
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    { type: "ARTILLERY", player: "RED", orientation: 0 },
    { type: "HQ", player: "RED" },
  ],
];

const initialBoardSetupWithAnAirborneNotBack: GHQState["board"] = [
  [
    { type: "HQ", player: "BLUE" },
    { type: "ARTILLERY", player: "BLUE", orientation: 180 },
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  [
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    { type: "AIRBORNE_INFANTRY", player: "BLUE" },
    null,
    null,
    null,
    null,
  ],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [
    null,
    null,
    null,
    null,
    null,
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    { type: "ARTILLERY", player: "RED", orientation: 0 },
    { type: "HQ", player: "RED" },
  ],
];