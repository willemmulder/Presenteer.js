/**
* Sylvester is © 2007–2012 James Coglan, and is released under the MIT license. 
* This is a slimmed-down version by Willem Mulder for the sole purpose of inversing a matrix.
* Also released under the MIT license.
*/

var Sylvester = {
  precision: 1e-6
};

Sylvester.Matrix = function() {};

Sylvester.Matrix.create = function(elements) {
  var M = new Sylvester.Matrix();
  return M.setElements(elements);
};
var $M = Sylvester.Matrix.create;

Sylvester.Matrix.I = function(n) {
  var els = [], i = n, j;
  while (i--) { j = n;
    els[i] = [];
    while (j--) {
      els[i][j] = (i === j) ? 1 : 0;
    }
  }
  return Sylvester.Matrix.create(els);
};

Sylvester.Matrix.prototype = {
  e: function(i,j) {
    if (i < 1 || i > this.elements.length || j < 1 || j > this.elements[0].length) { return null; }
    return this.elements[i-1][j-1];
  },

  row: function(i) {
    if (i > this.elements.length) { return null; }
    return Sylvester.Vector.create(this.elements[i-1]);
  },

  col: function(j) {
    if (this.elements.length === 0) { return null; }
    if (j > this.elements[0].length) { return null; }
    var col = [], n = this.elements.length;
    for (var i = 0; i < n; i++) { col.push(this.elements[i][j-1]); }
    return Sylvester.Vector.create(col);
  },

  dimensions: function() {
    var cols = (this.elements.length === 0) ? 0 : this.elements[0].length;
    return {rows: this.elements.length, cols: cols};
  },

  rows: function() {
    return this.elements.length;
  },

  cols: function() {
    if (this.elements.length === 0) { return 0; }
    return this.elements[0].length;
  },

  dup: function() {
    return Sylvester.Matrix.create(this.elements);
  },

  isSquare: function() {
    var cols = (this.elements.length === 0) ? 0 : this.elements[0].length;
    return (this.elements.length === cols);
  },

  toRightTriangular: function() {
    if (this.elements.length === 0) return Sylvester.Matrix.create([]);
    var M = this.dup(), els;
    var n = this.elements.length, i, j, np = this.elements[0].length, p;
    for (i = 0; i < n; i++) {
      if (M.elements[i][i] === 0) {
        for (j = i + 1; j < n; j++) {
          if (M.elements[j][i] !== 0) {
            els = [];
            for (p = 0; p < np; p++) { els.push(M.elements[i][p] + M.elements[j][p]); }
            M.elements[i] = els;
            break;
          }
        }
      }
      if (M.elements[i][i] !== 0) {
        for (j = i + 1; j < n; j++) {
          var multiplier = M.elements[j][i] / M.elements[i][i];
          els = [];
          for (p = 0; p < np; p++) {
            // Elements with column numbers up to an including the number of the
            // row that we're subtracting can safely be set straight to zero,
            // since that's the point of this routine and it avoids having to
            // loop over and correct rounding errors later
            els.push(p <= i ? 0 : M.elements[j][p] - M.elements[i][p] * multiplier);
          }
          M.elements[j] = els;
        }
      }
    }
    return M;
  },

  determinant: function() {
    if (this.elements.length === 0) { return 1; }
    if (!this.isSquare()) { return null; }
    var M = this.toRightTriangular();
    var det = M.elements[0][0], n = M.elements.length;
    for (var i = 1; i < n; i++) {
      det = det * M.elements[i][i];
    }
    return det;
  },

  isSingular: function() {
    return (this.isSquare() && this.determinant() === 0);
  },

  augment: function(matrix) {
    if (this.elements.length === 0) { return this.dup(); }
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) === 'undefined') { M = Sylvester.Matrix.create(M).elements; }
    var T = this.dup(), cols = T.elements[0].length;
    var i = T.elements.length, nj = M[0].length, j;
    if (i !== M.length) { return null; }
    while (i--) { j = nj;
      while (j--) {
        T.elements[i][cols + j] = M[i][j];
      }
    }
    return T;
  },

  inverse: function() {
    if (this.elements.length === 0) { return null; }
    if (!this.isSquare() || this.isSingular()) { return null; }
    var n = this.elements.length, i= n, j;
    var M = this.augment(Sylvester.Matrix.I(n)).toRightTriangular();
    var np = M.elements[0].length, p, els, divisor;
    var inverse_elements = [], new_element;
    // Sylvester.Matrix is non-singular so there will be no zeros on the
    // diagonal. Cycle through rows from last to first.
    while (i--) {
      // First, normalise diagonal elements to 1
      els = [];
      inverse_elements[i] = [];
      divisor = M.elements[i][i];
      for (p = 0; p < np; p++) {
        new_element = M.elements[i][p] / divisor;
        els.push(new_element);
        // Shuffle off the current row of the right hand side into the results
        // array as it will not be modified by later runs through this loop
        if (p >= n) { inverse_elements[i].push(new_element); }
      }
      M.elements[i] = els;
      // Then, subtract this row from those above it to give the identity matrix
      // on the left hand side
      j = i;
      while (j--) {
        els = [];
        for (p = 0; p < np; p++) {
          els.push(M.elements[j][p] - M.elements[i][p] * M.elements[j][i]);
        }
        M.elements[j] = els;
      }
    }
    return Sylvester.Matrix.create(inverse_elements);
  },

  setElements: function(els) {
    var i, j, elements = els.elements || els;
    if (elements[0] && typeof(elements[0][0]) !== 'undefined') {
      i = elements.length;
      this.elements = [];
      while (i--) { j = elements[i].length;
        this.elements[i] = [];
        while (j--) {
          this.elements[i][j] = elements[i][j];
        }
      }
      return this;
    }
    var n = elements.length;
    this.elements = [];
    for (i = 0; i < n; i++) {
      this.elements.push([elements[i]]);
    }
    return this;
  }
};

Sylvester.Matrix.prototype.toUpperTriangular = Sylvester.Matrix.prototype.toRightTriangular;
Sylvester.Matrix.prototype.det = Sylvester.Matrix.prototype.determinant;
Sylvester.Matrix.prototype.tr = Sylvester.Matrix.prototype.trace;
Sylvester.Matrix.prototype.rk = Sylvester.Matrix.prototype.rank;
Sylvester.Matrix.prototype.inv = Sylvester.Matrix.prototype.inverse;
Sylvester.Matrix.prototype.x = Sylvester.Matrix.prototype.multiply;
