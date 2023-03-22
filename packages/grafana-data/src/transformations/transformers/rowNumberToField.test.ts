import { toDataFrame } from '../../dataframe';
import { DataFrame, DataTransformerConfig, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ArrayVector, IndexVector } from '../../vector';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import {
  getFrameWithRowIndex,
  rowNumberToFieldTransformer,
  RowNumberToFieldTransformerOptions,
} from './rowNumberToField';

describe('RowNumberToField Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([rowNumberToFieldTransformer]);
  });

  const cfg: DataTransformerConfig<RowNumberToFieldTransformerOptions> = {
    id: DataTransformerID.rowNumberToField,
    options: {},
  };

  it('adds a row number field', async () => {
    const data = toDataFrame({
      name: 'A',
      fields: [{ name: 'temperature', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] }],
    });

    await expect(transformDataFrame([cfg], [data])).toEmitValuesWith((received) => {
      const data = received[0];
      const organized = data[0];
      expect(organized.fields).toEqual([
        {
          config: { min: 0, max: 3 },
          name: 'Row',
          type: FieldType.number,
          values: new IndexVector(4),
        },
        {
          config: {},
          name: 'temperature',
          type: FieldType.number,
          values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
        },
      ]);
    });
  });

  it('handles repeated transformations correctly', async () => {
    const frame: DataFrame = {
      name: 'A',
      fields: [
        {
          config: { min: 0, max: 3 },
          name: 'Row',
          type: FieldType.number,
          values: new IndexVector(4),
        },
        {
          config: {},
          name: 'temperature',
          type: FieldType.number,
          values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
        },
      ],
      length: 4,
    };

    await expect(transformDataFrame([cfg], [frame])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data[0]).toBe(frame); // noop, pass though
    });
  });

  it('updates row count when data changes', async () => {
    const inputs = toDataFrame({
      name: 'A',
      fields: [
        {
          name: 'Row',
          type: FieldType.number,
          values: [0], // NOT the index field
        },
        {
          name: 'temperature',
          type: FieldType.number,
          values: [10.3, 10.4, 10.5, 10.6],
        },
      ],
    });

    await expect(transformDataFrame([cfg], [inputs])).toEmitValuesWith((received) => {
      const data = received[0];
      const organized = data[0];
      expect(organized.fields).toEqual([
        {
          config: { min: 0, max: 3 },
          name: 'Row',
          type: FieldType.number,
          values: new IndexVector(4),
        },
        {
          config: {},
          name: 'Row',
          type: FieldType.number,
          values: new ArrayVector([0, undefined, undefined, undefined]),
        },
        {
          config: {},
          name: 'temperature',
          type: FieldType.number,
          values: new ArrayVector([10.3, 10.4, 10.5, 10.6]),
        },
      ]);
    });
  });
});
