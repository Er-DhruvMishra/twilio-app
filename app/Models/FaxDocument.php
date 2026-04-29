<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FaxDocument extends Model
{
    protected $fillable = ['fax_id', 'original_name', 'local_path', 'size_bytes', 'pages'];

    public function fax(): BelongsTo
    {
        return $this->belongsTo(Fax::class);
    }
}
